use std::path::{Path, PathBuf};
use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use uuid::Uuid;
use tauri::Emitter;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::settings::*;
use crate::lib_refactored::engine_management::*;
use crate::lib_refactored::library_management::*;
use crate::lib_refactored::assets::*;
use crate::lib_refactored::characters::*;
use crate::lib_refactored::models::*;
use crate::lib_refactored::kohya_configs::*;
use crate::lib_refactored::gpu::*;
use crate::lib_refactored::python_utils::*;
use crate::config;
use crate::system::{apply_python_utf8_env, write_accelerate_config_file};

fn prepare_kohya_configs_via_runner(
    repo_root: &Path,
    python_exec: &str,
    root: &Path,
    settings: &AppSettings,
    run_dir: &Path,
    sd_scripts_dir: Option<&Path>,
) -> Result<(), String> {
    let script = runner_script(repo_root);
    let mut command = Command::new(python_exec);
    command
        .arg(script)
        .arg("prepare-kohya")
        .arg("--run-dir")
        .arg(run_dir)
        .env("FILMCLUSIVE_REPO_ROOT", repo_root)
        .current_dir(repo_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = sd_scripts_dir {
        command.env("FILMCLUSIVE_SD_SCRIPTS_DIR", dir);
    }
    apply_model_download_env(&mut command, root, settings)?;

    let output = command.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "Failed to prepare kohya configs. exit={:?} stdout={} stderr={}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout).trim(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn create_run(
    app: tauri::AppHandle,
    project_name: String,
    dataset_dir: String,
    preset_id: String,
    training_overrides: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let mut argv: Vec<String> = vec![
        "create-run".to_string(),
        "--project-name".to_string(),
        project_name,
        "--dataset-dir".to_string(),
        dataset_dir,
        "--preset-id".to_string(),
        preset_id,
        "--sdxl-base-model-path".to_string(),
        settings.sdxl_base_model_path.clone(),
        "--mixed-precision".to_string(),
        settings.mixed_precision.clone(),
        "--optimizer-type".to_string(),
        settings.optimizer_type.clone(),
    ];
    if let Some(vae) = settings.sdxl_vae_path.clone() {
        if !vae.trim().is_empty() {
            argv.push("--sdxl-vae-path".to_string());
            argv.push(vae);
        }
    }
    let mut effective_overrides = training_overrides.unwrap_or(serde_json::Value::Null);
    if effective_overrides.is_null() {
        effective_overrides = serde_json::json!({});
    }
    if let Some(obj) = effective_overrides.as_object_mut() {
        let training_value = obj
            .entry("training".to_string())
            .or_insert_with(|| serde_json::json!({}));
        if let Some(training) = training_value.as_object_mut() {
            let adapter_command = settings.adapter_command.trim();
            if !adapter_command.is_empty()
                && training
                    .get("adapter_command")
                    .and_then(|v| v.as_str())
                    .map(|v| v.trim().is_empty())
                    .unwrap_or(true)
            {
                training.insert(
                    "adapter_command".to_string(),
                    serde_json::Value::String(adapter_command.to_string()),
                );
            }
            // ... (rest of adapter settings insertion logic)
        }
    }
    argv.push("--training-overrides-json".to_string());
    argv.push(serde_json::to_string(&effective_overrides).map_err(|e| e.to_string())?);
    
    let argv_ref: Vec<&str> = argv.iter().map(|s| s.as_str()).collect();
    let python_exec = effective_python_executable(&app, &root, &settings);
    run_python_json_with_exec(
        &repo_root,
        python_exec.as_str(),
        &root,
        &settings,
        &argv_ref,
    )
}

#[tauri::command]
pub fn create_character_run(
    app: tauri::AppHandle,
    project_id: Uuid,
    character_id: Uuid,
    preset_id: String,
    training_overrides: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let lib = load_library(&root)?;
    let project = lib
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let character = project
        .characters
        .iter()
        .find(|c| c.id == character_id)
        .ok_or("Character not found.")?;

    ensure_character_dirs(&root, project_id, character_id)?;
    let paths = character_paths(&root, project_id, character_id);

    let mut argv: Vec<String> = vec![
        "create-run".to_string(),
        "--project-name".to_string(),
        character.name.clone(),
        "--dataset-dir".to_string(),
        paths.images_dir.clone(),
        "--preset-id".to_string(),
        preset_id,
        "--runs-root".to_string(),
        paths.runs_root.clone(),
        "--sdxl-base-model-path".to_string(),
        settings.sdxl_base_model_path.clone(),
        "--mixed-precision".to_string(),
        settings.mixed_precision.clone(),
        "--optimizer-type".to_string(),
        settings.optimizer_type.clone(),
    ];
    if let Some(vae) = settings.sdxl_vae_path.clone() {
        if !vae.trim().is_empty() {
            argv.push("--sdxl-vae-path".to_string());
            argv.push(vae);
        }
    }
    
    let mut effective_overrides = training_overrides.unwrap_or(serde_json::Value::Null);
    if effective_overrides.is_null() {
        effective_overrides = serde_json::json!({});
    }
    // ... (logic to insert adapter settings from AppSettings if missing)
    
    argv.push("--training-overrides-json".to_string());
    argv.push(serde_json::to_string(&effective_overrides).map_err(|e| e.to_string())?);
    
    let argv_ref: Vec<&str> = argv.iter().map(|s| s.as_str()).collect();
    let python_exec = effective_python_executable(&app, &root, &settings);
    run_python_json_with_exec(
        &repo_root,
        python_exec.as_str(),
        &root,
        &settings,
        &argv_ref,
    )
}

#[tauri::command]
pub fn create_asset_run(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
    preset_id: String,
    training_overrides: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let lib = load_library(&root)?;
    let project = lib
        .projects
        .iter()
        .find(|project| project.id == project_id)
        .ok_or("Project not found.")?;
    let asset = project
        .assets
        .iter()
        .find(|asset| asset.id == asset_id)
        .ok_or("Asset not found.")?;
    let paths = ensure_asset_dirs(&root, project, asset_id)?;

    let mut effective_overrides = training_overrides.unwrap_or_else(|| serde_json::json!({}));
    if let Some(obj) = effective_overrides.as_object_mut() {
        let training_value = obj
            .entry("training".to_string())
            .or_insert_with(|| serde_json::json!({}));
        if let Some(training) = training_value.as_object_mut() {
            training.entry("model_family".to_string()).or_insert_with(|| serde_json::Value::String(asset.model_family.clone()));
            training.entry("trigger_tokens".to_string()).or_insert_with(|| serde_json::Value::Array(asset.trigger_tokens.iter().cloned().map(serde_json::Value::String).collect()));
            if matches!(asset.model_family.as_str(), "sdxl" | "sd15" | "flux") {
                training.insert("engine".to_string(), serde_json::Value::String("kohya".to_string()));
                if asset.model_family == "flux" {
                    inject_flux_defaults(training, &settings);
                }
            } else {
                training.insert("engine".to_string(), serde_json::Value::String(format!("adapter:{}", asset.model_family)));
                // ... (insert other adapter settings from AppSettings)
            }
        }
    }

    let mut argv: Vec<String> = vec![
        "create-run".to_string(),
        "--project-name".to_string(),
        asset.name.clone(),
        "--dataset-dir".to_string(),
        paths.images_dir.clone(),
        "--preset-id".to_string(),
        preset_id,
        "--runs-root".to_string(),
        paths.runs_root.clone(),
        "--sdxl-base-model-path".to_string(),
        settings.sdxl_base_model_path.clone(),
        "--mixed-precision".to_string(),
        settings.mixed_precision.clone(),
        "--optimizer-type".to_string(),
        settings.optimizer_type.clone(),
        "--training-overrides-json".to_string(),
        serde_json::to_string(&effective_overrides).map_err(|e| e.to_string())?,
    ];
    if let Some(vae) = settings.sdxl_vae_path.clone() {
        if !vae.trim().is_empty() {
            argv.push("--sdxl-vae-path".to_string());
            argv.push(vae);
        }
    }
    let argv_ref: Vec<&str> = argv.iter().map(|item| item.as_str()).collect();
    let python_exec = effective_python_executable(&app, &root, &settings);
    run_python_json_with_exec(
        &repo_root,
        python_exec.as_str(),
        &root,
        &settings,
        &argv_ref,
    )
}

#[tauri::command]
pub fn prepare_training_package(
    app: tauri::AppHandle,
    run_dir: String,
) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let python_exec = effective_python_executable(&app, &root, &settings);

    let run_path = PathBuf::from(&run_dir);
    if !run_path.is_dir() {
        return Err(filmclusive_error(
            "RUN_DIR_MISSING",
            "Run directory not found.",
            &["Build the training package again to create a new run folder."],
            Some(run_dir),
        ));
    }

    run_python_json_with_exec(
        &repo_root,
        python_exec.as_str(),
        &root,
        &settings,
        &["prepare-kohya", "--run-dir", run_dir.as_str()],
    )
}

#[tauri::command]
pub fn start_training(
    app: tauri::AppHandle,
    state: tauri::State<'_, RunnerState>,
    run_dir: String,
    engine_key: Option<String>,
) -> Result<(), String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let run_id = run_dir.clone();
    let run_dir_path = PathBuf::from(&run_dir);
    let run_log_path = run_dir_path.join("training_log.txt");

    if cfg!(target_os = "linux") {
        let gpu = linux_gpu_preflight(12);
        if let GpuPreflight::LinuxNvidia { ok: false, messages, error, .. } = gpu {
            let mut msg = "GPU check failed. Training is disabled.".to_string();
            if let Some(e) = error { msg = format!("{msg} {e}"); }
            if !messages.is_empty() { msg = format!("{msg} {}", messages.join(" ")); }
            return Err(msg);
        }
    }

    let python_exec = effective_python_executable(&app, &root, &settings);
    let requested_engine = normalize_requested_engine(
        engine_key.filter(|v| !v.trim().is_empty()).or_else(|| read_run_engine_key(&run_dir_path)),
        &run_dir_path,
    );

    ensure_flux_config_snapshot(&run_dir_path, &settings)?;
    if requested_engine.as_deref().map(|v| v.starts_with("adapter")).unwrap_or(false) {
        ensure_adapter_config_snapshot(&run_dir_path, &settings)?;
    }

    let use_native_windows_kohya = cfg!(target_os = "windows")
        && requested_engine.as_deref().map(|v| v == "kohya" || v == "kohya_sd_scripts").unwrap_or(true);

    if let Err(e) = fs::OpenOptions::new().create(true).write(true).truncate(true).open(&run_log_path) {
        return Err(format!("Failed to initialize training log file: {} ({})", run_log_path.display(), e));
    }

    let mut cmd = if use_native_windows_kohya {
        let sys_cfg = config::system_config::SystemConfig::load(&system_config_path(&root))?;
        let gpu_count = read_run_cuda_visible_devices(&run_dir_path).map(|v| v.split(',').filter(|s| !s.trim().is_empty()).count() as u32).unwrap_or(1);
        write_accelerate_config_file(sys_cfg.accelerate_config_path.as_path(), gpu_count, settings.mixed_precision.as_str())?;

        let entrypoint_name = kohya_entrypoint_name_for_run(&run_dir_path);
        let entrypoint_path = sys_cfg.sd_scripts_dir.join(entrypoint_name);
        if !entrypoint_path.is_file() {
            return Err(filmclusive_error("SD_SCRIPTS_MISSING", "Training scripts (sd-scripts) are missing.", &["Install training scripts in Settings."], Some(entrypoint_path.display().to_string())));
        }

        prepare_kohya_configs_via_runner(&repo_root, sys_cfg.venv_python.to_string_lossy().as_ref(), &root, &settings, &run_dir_path, Some(sys_cfg.sd_scripts_dir.as_path()))?;

        let mut c = Command::new(&sys_cfg.venv_python);
        c.arg("-m").arg("accelerate.commands.launch").arg("--config_file").arg(&sys_cfg.accelerate_config_path).arg(entrypoint_path).arg("--config_file").arg(run_dir_path.join("kohya_config.toml")).env("FILMCLUSIVE_REPO_ROOT", &repo_root).current_dir(&sys_cfg.sd_scripts_dir).stdout(Stdio::piped()).stderr(Stdio::piped());
        if let Some(devs) = read_run_cuda_visible_devices(&run_dir_path) { c.env("CUDA_VISIBLE_DEVICES", devs); }
        apply_python_utf8_env(&mut c);
        c
    } else {
        let mut c = Command::new(python_exec);
        c.arg(runner_script(&repo_root)).arg("train").arg("--run-dir").arg(&run_dir);
        if let Some(engine) = requested_engine { c.arg("--engine").arg(engine); }
        c.env("FILMCLUSIVE_REPO_ROOT", &repo_root).current_dir(&repo_root).stdout(Stdio::piped()).stderr(Stdio::piped());
        apply_python_utf8_env(&mut c);
        c
    };

    apply_model_download_env(&mut cmd, &root, &settings)?;
    let sleep_guard = SleepGuard::new(settings.prevent_sleep_during_training);
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let shared = Arc::new(Mutex::new(child));
    {
        let mut map = state.processes.lock().unwrap();
        map.insert(run_id.clone(), Arc::clone(&shared));
    }
    if let Some(guard) = sleep_guard {
        let mut guard_map = state.sleep_guards.lock().unwrap();
        guard_map.insert(run_id.clone(), guard);
    }

    let _ = app.emit("runner:status", RunnerStatusEvent::Started { run_id: run_id.clone() });

    let app_for_thread = app.clone();
    let processes_for_thread = Arc::clone(&state.processes);
    let sleep_guards_for_thread = Arc::clone(&state.sleep_guards);
    let shared_for_thread = Arc::clone(&shared);
    let run_log_path_for_thread = run_log_path.clone();
    let capture_to_file = use_native_windows_kohya;

    thread::spawn(move || {
        let log_file = if capture_to_file { fs::OpenOptions::new().create(true).append(true).open(&run_log_path_for_thread).ok().map(|f| Arc::new(Mutex::new(f))) } else { None };
        let run_id_inner = run_id.clone();
        let app_inner = app_for_thread.clone();
        let log_file_inner = log_file.clone();

        let stderr_thread = thread::spawn(move || {
            for line in BufReader::new(stderr).lines().flatten() {
                if let Some(f) = log_file_inner.as_ref() { let _ = writeln!(f.lock().unwrap(), "{line}"); }
                let _ = app_inner.emit("runner:log", RunnerLogEvent { run_id: run_id_inner.clone(), line });
            }
        });

        for line in BufReader::new(stdout).lines().flatten() {
            if let Some(f) = log_file.as_ref() { let _ = writeln!(f.lock().unwrap(), "{line}"); }
            let _ = app_for_thread.emit("runner:log", RunnerLogEvent { run_id: run_id.clone(), line });
        }
        let _ = stderr_thread.join();

        let exit_code = shared_for_thread.lock().unwrap().wait().ok().and_then(|s| s.code()).unwrap_or(-1);
        processes_for_thread.lock().unwrap().remove(&run_id);
        sleep_guards_for_thread.lock().unwrap().remove(&run_id);

        let status = if exit_code == 0 { RunnerStatusEvent::Completed { run_id: run_id.clone(), exit_code } } else {
            let mut msg = format!("Training process exited with code {exit_code}.");
            if let Some(tail) = tail_text(&run_log_path_for_thread, 80, 12_000) { if !tail.trim().is_empty() { msg = format!("{msg}\n\nLast log lines:\n{tail}"); } }
            RunnerStatusEvent::Failed { run_id: run_id.clone(), message: msg }
        };
        let _ = app_for_thread.emit("runner:status", status);
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_training(state: tauri::State<'_, RunnerState>, run_id: String) -> Result<(), String> {
    let shared = state.processes.lock().unwrap().get(&run_id).cloned();
    let Some(shared) = shared else { return Err("No active run found.".to_string()); };
    let mut child = shared.lock().unwrap();
    if cfg!(target_os = "windows") {
        Command::new("taskkill").arg("/PID").arg(child.id().to_string()).arg("/T").arg("/F").status().map_err(|e| e.to_string())?;
    } else {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_training_running(state: tauri::State<'_, RunnerState>, run_id: String) -> bool {
    state.processes.lock().unwrap().contains_key(&run_id)
}

#[tauri::command]
pub fn get_training_log_tail(run_dir: String) -> Result<String, String> {
    let path = PathBuf::from(run_dir).join("training_log.txt");
    tail_text(&path, 500, 100_000).ok_or_else(|| "Log file not found or empty.".to_string())
}

#[tauri::command]
pub fn run_artifacts_status(run_dir: String) -> Result<RunArtifactsStatus, String> {
    let dir = PathBuf::from(&run_dir);
    if !dir.is_dir() { return Err(filmclusive_error("RUN_DIR_MISSING", "Run directory not found.", &["Build training package again."], Some(run_dir))); }
    let mut safetensors = Vec::new();
    if let Ok(rd) = fs::read_dir(&dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_file() && p.extension().map(|s| s.eq_ignore_ascii_case("safetensors")).unwrap_or(false) {
                safetensors.push(p.to_string_lossy().to_string());
            }
        }
    }
    safetensors.sort();
    Ok(RunArtifactsStatus {
        run_dir,
        has_config_snapshot: dir.join("config_snapshot.json").is_file(),
        has_dataset_manifest: dir.join("dataset_manifest.json").is_file(),
        has_dataset_config: dir.join("dataset_config.toml").is_file(),
        has_kohya_config: dir.join("kohya_config.toml").is_file(),
        safetensors,
        primary_safetensors_path: primary_safetensors_path(&dir),
        artifact_paths: artifact_paths_for_run(&dir),
    })
}
