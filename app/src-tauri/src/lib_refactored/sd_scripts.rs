use std::fs;
use std::process::Command;
use crate::{filmclusive_error, run_cmd_output};
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::config;

pub fn sd_scripts_report_from_cfg(cfg: &config::system_config::SystemConfig) -> SdScriptsReport {
    let sdxl_train = cfg.sd_scripts_dir.join("sdxl_train_network.py").is_file();
    let flux_train = cfg.sd_scripts_dir.join("flux_train_network.py").is_file();
    let ok = sdxl_train || flux_train;
    SdScriptsReport {
        ok,
        sd_scripts_dir: cfg.sd_scripts_dir.to_string_lossy().to_string(),
        sdxl_train_network_py: sdxl_train,
        flux_train_network_py: flux_train,
        message: if ok {
            "Training scripts are installed.".to_string()
        } else {
            "Training scripts are not installed yet.".to_string()
        },
    }
}

#[tauri::command]
pub fn sd_scripts_report(app: tauri::AppHandle) -> Result<SdScriptsReport, String> {
    let root = library_root(&app)?;
    let cfg_path = system_config_path(&root);
    let sys_cfg = config::system_config::SystemConfig::load(&cfg_path)?;
    Ok(sd_scripts_report_from_cfg(&sys_cfg))
}

#[tauri::command]
pub fn install_sd_scripts(app: tauri::AppHandle) -> Result<InstallSdScriptsReport, String> {
    let root = library_root(&app)?;
    let cfg_path = system_config_path(&root);
    let sys_cfg = config::system_config::SystemConfig::load(&cfg_path)?;

    let mut steps: Vec<String> = Vec::new();
    steps.push(format!(
        "Installing training scripts into {}",
        sys_cfg.sd_scripts_dir.display()
    ));

    let entry_flux = sys_cfg.sd_scripts_dir.join("flux_train_network.py");
    let entry_sdxl = sys_cfg.sd_scripts_dir.join("sdxl_train_network.py");
    if entry_flux.is_file() || entry_sdxl.is_file() {
        steps.push("Already installed.".to_string());
        return Ok(InstallSdScriptsReport {
            ok: true,
            steps,
            sd_scripts_dir: sys_cfg.sd_scripts_dir.to_string_lossy().to_string(),
        });
    }

    if let Some(parent) = sys_cfg.sd_scripts_dir.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut clone = Command::new("git");
    clone
        .env("GIT_TERMINAL_PROMPT", "0")
        .arg("clone")
        .arg("--depth")
        .arg("1")
        .arg("https://github.com/kohya-ss/sd-scripts.git")
        .arg(&sys_cfg.sd_scripts_dir);

    let out = run_cmd_output(clone)?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        return Err(filmclusive_error(
            "SD_SCRIPTS_INSTALL_FAILED",
            "Failed to install training scripts (sd-scripts).",
            &[
                "Ensure Git is installed and available in PATH.",
                "Retry from Settings \u{2192} System \u{2192} Install training scripts.",
            ],
            Some(format!(
                "sd_scripts_dir={}\nexit={:?}\nstdout={}\nstderr={}",
                sys_cfg.sd_scripts_dir.display(),
                out.status.code(),
                stdout.trim(),
                stderr.trim()
            )),
        ));
    }
    steps.push("Cloned sd-scripts.".to_string());

    let req = sys_cfg.sd_scripts_dir.join("requirements.txt");
    if req.is_file() {
        let mut pip = Command::new(&sys_cfg.venv_python);
        pip.arg("-m").arg("pip").arg("install");
        if sys_cfg.wheelhouse_dir.is_dir() {
            pip.arg("--no-index")
                .arg("--find-links")
                .arg(&sys_cfg.wheelhouse_dir);
            steps.push(format!(
                "Installing requirements from wheelhouse: {}",
                sys_cfg.wheelhouse_dir.display()
            ));
        } else {
            steps.push("Installing requirements from PyPI (wheelhouse not found).".to_string());
        }
        pip.arg("-r").arg(&req);
        let out = run_cmd_output(pip)?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            let stdout = String::from_utf8_lossy(&out.stdout);
            return Err(filmclusive_error(
                "SD_SCRIPTS_DEP_INSTALL_FAILED",
                "Failed to install sd-scripts dependencies.",
                &[
                    "Retry from Settings \u{2192} System \u{2192} Install training scripts.",
                    "If it repeats, run Engine check and share the error details with a developer.",
                ],
                Some(format!(
                    "venv_python={}\nrequirements={}\nexit={:?}\nstdout={}\nstderr={}",
                    sys_cfg.venv_python.display(),
                    req.display(),
                    out.status.code(),
                    stdout.trim(),
                    stderr.trim()
                )),
            ));
        }
        steps.push("Installed sd-scripts dependencies.".to_string());
    } else {
        steps.push("Clone completed but requirements.txt was not found.".to_string());
    }

    let post = sd_scripts_report_from_cfg(&sys_cfg);
    if !post.ok {
        return Err(filmclusive_error(
            "SD_SCRIPTS_MISSING",
            "Training scripts are still missing after install.",
            &[
                "Retry the install.",
                "If it repeats, share the error details with a developer.",
            ],
            Some(format!(
                "sd_scripts_dir={}\nsdxl_train_network_py={}\nflux_train_network_py={}",
                post.sd_scripts_dir, post.sdxl_train_network_py, post.flux_train_network_py
            )),
        ));
    }

    Ok(InstallSdScriptsReport {
        ok: true,
        steps,
        sd_scripts_dir: sys_cfg.sd_scripts_dir.to_string_lossy().to_string(),
    })
}
