use std::path::{Path, PathBuf};
use std::fs;
use dirs_next::document_dir;
use tauri::Manager;
use crate::lib_refactored::types::AppSettings;

pub fn library_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(workspace_root) = filmclusive_config::default_workspace_root() {
        let root = workspace_root.join("train");
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        return Ok(root);
    }
    let base = document_dir().or_else(|| app.path().app_data_dir().ok());
    let base = base.ok_or_else(|| "Unable to determine a writable data directory".to_string())?;
    let root = base.join("Filmclusive LoRAs");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

pub fn library_path(root: &Path) -> PathBuf {
    root.join("library.json")
}

pub fn settings_path(root: &Path) -> PathBuf {
    root.join("settings.json")
}

pub fn system_config_path(root: &Path) -> PathBuf {
    root.join("system_config.json")
}

pub fn default_model_download_root(root: &Path) -> PathBuf {
    root.join("engine").join("models")
}

pub fn effective_model_download_root(root: &Path, settings: &AppSettings) -> PathBuf {
    let trimmed = settings.model_download_root.trim();
    if trimmed.is_empty() {
        return default_model_download_root(root);
    }
    PathBuf::from(trimmed)
}

pub fn huggingface_cache_root(root: &Path, settings: &AppSettings) -> PathBuf {
    effective_model_download_root(root, settings)
        .join("cache")
        .join("huggingface")
}

pub fn managed_manifest_path(root: &Path, settings: &AppSettings) -> PathBuf {
    effective_model_download_root(root, settings)
        .join("flux")
        .join("install_manifest.json")
}

pub fn flux_file_destination(root: &Path, settings: &AppSettings, file: &crate::lib_refactored::types::FluxCatalogFile) -> PathBuf {
    effective_model_download_root(root, settings).join(&file.relative_path)
}

pub fn artifact_paths_for_run(run_dir: &Path) -> crate::lib_refactored::types::ArtifactPaths {
    crate::lib_refactored::types::ArtifactPaths {
        config_snapshot_path: run_dir
            .join("config_snapshot.json")
            .to_string_lossy()
            .to_string(),
        dataset_manifest_path: run_dir
            .join("dataset_manifest.json")
            .to_string_lossy()
            .to_string(),
        dataset_config_path: run_dir
            .join("dataset_config.toml")
            .to_string_lossy()
            .to_string(),
        kohya_config_path: run_dir
            .join("kohya_config.toml")
            .to_string_lossy()
            .to_string(),
        training_log_path: run_dir
            .join("training_log.txt")
            .to_string_lossy()
            .to_string(),
    }
}

pub fn managed_python_executable(root: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        root.join("engine")
            .join(".venv")
            .join("Scripts")
            .join("python.exe")
    } else {
        root.join("engine").join(".venv").join("bin").join("python")
    }
}

pub fn windows_managed_python_312_dir(root: &Path) -> PathBuf {
    root.join("engine").join("python312")
}

pub fn windows_managed_python_312_executable(root: &Path) -> PathBuf {
    windows_managed_python_312_dir(root).join("python.exe")
}
