use std::path::PathBuf;
use std::fs;
use std::process::{Command, Stdio};
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::engine_management::*;
use crate::lib_refactored::settings::*;
use crate::lib_refactored::engine_report::*;
use crate::lib_refactored::python_utils::*;
use crate::lib_refactored::gpu::*;

#[tauri::command]
pub fn auto_setup_engine(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let mut settings = load_settings(&root)?;
    let mut steps: Vec<String> = Vec::new();
    let error_tail = |steps: &[String]| -> String {
        let start = steps.len().saturating_sub(30);
        steps[start..].join("\n")
    };

    if let Some(bundled_python) = bundled_python_executable(&app, &settings) {
        let python_exec = bundled_python.to_string_lossy().to_string();
        settings.python_executable = python_exec.clone();
        save_settings(&root, &settings)?;
        steps.push(format!("Using bundled Python runtime: {python_exec}"));
        let report = engine_preflight(app.clone())?;
        let bundled_ok = report.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
        if bundled_ok {
            return Ok(serde_json::json!({
                "python_executable": settings.python_executable,
                "used_bundled_runtime": true,
                "steps": steps,
                "engine_report": report
            }));
        }
        steps.push(
            "Bundled runtime is missing dependencies; creating managed virtual environment."
                .to_string(),
        );
    }

    let bootstrap_python = match detect_bootstrap_python(&settings, &mut steps) {
        Ok(found) => found,
        Err(BootstrapPythonFailure::Missing) => {
            if cfg!(target_os = "windows") {
                steps.push("Python 3.11–3.13 not found; installing managed Python 3.12…".to_string());
                ensure_windows_python_312(&repo_root, &root, &mut steps).map_err(|e| {
                    filmclusive_error("PYTHON_INSTALL_FAILED", "Auto setup failed while installing Python 3.12.", &["Confirm you have internet access.", "If you are offline, install Python 3.12 manually and select it in Settings > System.", "Retry Auto setup."], Some(format!("{e}\n{}", error_tail(&steps))))
                })?
            } else {
                return Err(filmclusive_error("PYTHON_BOOTSTRAP_MISSING", "Python not found to bootstrap a virtual environment.", &["Install Python 3.12 (recommended) or Python 3.11+ on your system.", "Set the Python executable in Settings > System.", "Retry Auto setup."], Some(error_tail(&steps))));
            }
        }
        Err(BootstrapPythonFailure::Unsupported { details }) => {
            if cfg!(target_os = "windows") {
                steps.push("Unsupported Python version detected; installing managed Python 3.12…".to_string());
                ensure_windows_python_312(&repo_root, &root, &mut steps).map_err(|e| {
                    filmclusive_error("PYTHON_INSTALL_FAILED", "Auto setup failed while installing Python 3.12.", &["Confirm you have internet access.", "If you are offline, install Python 3.12 manually and select it in Settings > System.", "Delete the existing managed environment (engine/.venv) and retry Auto setup."], Some(format!("{details}\n{e}\n{}", error_tail(&steps))))
                })?
            } else {
                return Err(filmclusive_error("PYTHON_BOOTSTRAP_UNSUPPORTED", "Unsupported Python version detected for Auto setup.", &["Install Python 3.12 (recommended) or Python 3.11/3.13.", "Set the Python executable in Settings > System.", "Delete the existing managed environment (engine/.venv) and retry Auto setup."], Some(format!("{details}\n{}", error_tail(&steps)))));
            }
        }
    };
    let venv_dir = root.join("engine").join(".venv");
    let venv_python = managed_python_executable(&root);
    fs::create_dir_all(venv_dir.parent().unwrap_or(&root)).map_err(|e| e.to_string())?;

    if venv_python.exists() {
        let out = Command::new(&venv_python).arg("--version").stdout(Stdio::piped()).stderr(Stdio::piped()).output();
        if let Ok(out) = out {
            push_output_lines(&mut steps, "venv-python-version", &out);
            if out.status.success() {
                if let Some(version) = parse_python_version(&out) {
                    if !python_version_supported(version) {
                        steps.push("Managed environment uses an unsupported Python version; rebuilding…".to_string());
                        let _ = fs::remove_dir_all(&venv_dir);
                    }
                }
            }
        }
    }

    if !venv_python.exists() {
        steps.push(format!("Creating virtual environment at {}", venv_dir.to_string_lossy()));
        run_command_steps(&repo_root, &bootstrap_python, &["-m", "venv", venv_dir.to_string_lossy().as_ref()], &[], "create-venv", &mut steps).map_err(|e| {
            filmclusive_error("AUTO_SETUP_FAILED", "Auto setup failed while creating the virtual environment.", &["Confirm Python is installed and available in your PATH.", "Retry Auto setup."], Some(format!("{e}\n{}", error_tail(&steps))))
        })?;
    } else {
        steps.push(format!("Using existing virtual environment at {}", venv_dir.to_string_lossy()));
    }

    let envs = [("FILMCLUSIVE_REPO_ROOT", repo_root.to_string_lossy().to_string())];
    let kohya_dir = repo_root.join("vendor").join("kohya");
    let kohya_requirements = kohya_dir.join("requirements.txt");
    if !kohya_dir.is_dir() || !kohya_requirements.is_file() {
        return Err(filmclusive_error("KOHYA_MISSING", "Training engine files are missing (kohya requirements not found).", &["Reinstall the app or restore the bundled engine files."], Some(format!("kohya_dir={}\nrequirements_txt_exists={}", kohya_dir.to_string_lossy(), kohya_requirements.is_file()))));
    }
    run_command_steps(&repo_root, venv_python.to_string_lossy().as_ref(), &["-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools"], &envs, "pip-bootstrap", &mut steps).map_err(|e| {
        filmclusive_error("AUTO_SETUP_FAILED", "Auto setup failed while bootstrapping pip.", &["Confirm your Python environment can run pip.", "Retry Auto setup."], Some(format!("{e}\n{}", error_tail(&steps))))
    })?;
    run_command_steps(&kohya_dir, venv_python.to_string_lossy().as_ref(), &["-m", "pip", "install", "-r", "requirements.txt"], &envs, "pip-kohya-reqs", &mut steps).map_err(|e| {
        filmclusive_error("AUTO_SETUP_FAILED", "Auto setup failed while installing kohya requirements.", &["Confirm you have internet access (or an offline wheelhouse, if configured).", "Retry Auto setup."], Some(format!("{e}\n{}", error_tail(&steps))))
    })?;

    let wheelhouse_candidates = if cfg!(target_os = "windows") { vec![root.join("engine").join("wheels"), PathBuf::from(r"C:\Filmclusive\engine\wheels")] } else { vec![root.join("engine").join("wheels")] };
    let wheelhouse = wheelhouse_candidates.into_iter().find(|p| path_has_wheels(p));

    let mut torch_args: Vec<String> = vec!["-m", "pip", "install"].into_iter().map(|s| s.to_string()).collect();
    if let Some(wheels_dir) = wheelhouse {
        let wheels_dir_str = wheels_dir.to_string_lossy().to_string();
        steps.push(format!("Installing torch from offline wheelhouse: {}", wheels_dir_str));
        torch_args.extend(["--no-index".to_string(), "--find-links".to_string(), wheels_dir_str, "--upgrade".to_string(), "--force-reinstall".to_string()].into_iter());
    } else if cfg!(target_os = "windows") || cfg!(target_os = "linux") {
        let cuda_variant = detect_cuda_variant_from_nvidia_smi();
        if let Some(variant) = cuda_variant {
            let index_url = format!("https://download.pytorch.org/whl/{variant}");
            steps.push(format!("Installing torch with CUDA wheels: {variant}"));
            torch_args.extend(["--index-url".to_string(), index_url, "--upgrade".to_string(), "--force-reinstall".to_string()]);
        } else {
            steps.push("Installing torch from default pip index (CPU/MPS build)".to_string());
        }
    } else {
        steps.push("Installing torch from default pip index (CPU/MPS build)".to_string());
    }
    torch_args.extend(["torch", "torchvision"].into_iter().map(|s| s.to_string()));

    run_command_steps_vec(&repo_root, venv_python.to_string_lossy().as_ref(), &torch_args, &envs, "pip-torch", &mut steps).map_err(|e| {
        filmclusive_error("AUTO_SETUP_FAILED", "Auto setup failed while installing torch/torchvision.", &["Confirm you have internet access.", "On Windows, GPU training requires CUDA-enabled torch wheels.", "Retry Auto setup."], Some(format!("{e}\n{}", error_tail(&steps))))
    })?;

    settings.python_executable = venv_python.to_string_lossy().to_string();
    save_settings(&root, &settings)?;
    let report = engine_preflight(app.clone())?;
    Ok(serde_json::json!({ "python_executable": settings.python_executable, "used_bundled_runtime": false, "steps": steps, "engine_report": report }))
}
