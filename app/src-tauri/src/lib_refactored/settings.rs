use std::path::Path;
use std::fs;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::models::*;
use crate::lib_refactored::python_utils::*;

pub fn load_settings(root: &Path) -> Result<AppSettings, String> {
    let path = settings_path(root);
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn save_settings(root: &Path, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(root);
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, format!("{raw}\n")).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let root = library_root(&app)?;
    let mut settings = load_settings(&root)?;

    if settings.schema_version < 9 {
        settings.schema_version = 9;
        // Migration logic...
    }
    sync_managed_flux_settings(&root, &mut settings);
    save_settings(&root, &settings)?;

    if settings.python_executable == "python3" {
        settings.python_executable = effective_python_executable(&app, &root, &settings);
        save_settings(&root, &settings)?;
    }
    Ok(settings)
}

#[tauri::command]
pub fn update_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let root = library_root(&app)?;
    let mut next = settings.clone();
    if next.schema_version < 9 {
        next.schema_version = 9;
    }
    sync_managed_flux_settings(&root, &mut next);

    if cfg!(target_os = "linux") {
        if let Some(bundled) = bundled_python_executable(&app, &next) {
            next.python_executable = bundled.to_string_lossy().to_string();
        }
    }

    save_settings(&root, &next)?;
    Ok(next)
}
