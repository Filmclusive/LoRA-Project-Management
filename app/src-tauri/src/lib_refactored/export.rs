use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::library_management::*;
use crate::lib_refactored::settings::*;
use crate::lib_refactored::models::*;
use crate::lib_refactored::import::*;
use crate::config;

pub fn copy_dataset_training_files(
    src_dir: &Path,
    dest_dir: &Path,
    copied_files: &mut Vec<String>,
) -> Result<(), String> {
    if !src_dir.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name() else {
            continue;
        };
        let dest = dest_dir.join(name);
        fs::copy(&path, &dest).map_err(|e| e.to_string())?;
        copied_files.push(dest.to_string_lossy().to_string());
    }
    Ok(())
}

pub fn folder_path_segments(project: &Project, folder_id: Uuid) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = project
        .folders
        .iter()
        .find(|folder| folder.id == folder_id)
        .cloned();
    while let Some(folder) = current {
        out.push(folder.name.clone());
        current = folder.parent_id.and_then(|parent_id| {
            project
                .folders
                .iter()
                .find(|candidate| candidate.id == parent_id)
                .cloned()
        });
    }
    out.reverse();
    out
}

#[tauri::command]
pub fn export_model(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
    model_id: String,
    destination_root: Option<String>,
    destination_mode: Option<String>,
) -> Result<String, String> {
    let root = library_root(&app)?;
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
    let settings = load_settings(&root)?;
    let system_config = config::system_config::SystemConfig::load(&system_config_path(&root))?;
    let destination_root = destination_root
        .as_deref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            if settings.default_export_dir.trim().is_empty() {
                system_config.models_lora_root
            } else {
                PathBuf::from(settings.default_export_dir.trim())
            }
        });
    let models = list_asset_model_summaries(&root, project, asset)?;
    let model = models
        .iter()
        .find(|model| model.id == model_id)
        .ok_or("Model not found.")?;
    let artifact = model.artifacts.first().ok_or("Model artifact not found.")?;
    let source_path = PathBuf::from(&artifact.path);
    if !source_path.is_file() {
        return Err("Model file is not available.".to_string());
    }

    let mut export_dir = destination_root.join(safe_path_segment(&project.name, "Project"));
    for segment in folder_path_segments(project, asset.folder_id) {
        export_dir = export_dir.join(safe_path_segment(&segment, "Folder"));
    }
    export_dir = export_dir.join(safe_path_segment(&asset.name, "Asset"));
    fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;

    source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("Invalid model file name.")?;
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("safetensors");
    let file_name = create_model_export_filename(project, asset, extension);
    let dest_path = export_dir.join(file_name);
    let mode = destination_mode.unwrap_or_else(|| "copy".to_string());
    if mode.eq_ignore_ascii_case("link") {
        try_link_file(&source_path, &dest_path)?;
    } else {
        fs::copy(&source_path, &dest_path).map_err(|e| e.to_string())?;
    }
    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_training_package(
    run_dir: String,
    destination_root: String,
) -> Result<ExportTrainingPackageResult, String> {
    let run_dir_path = PathBuf::from(&run_dir);
    if !run_dir_path.is_dir() {
        return Err("Run directory not found.".to_string());
    }
    let config_raw =
        fs::read_to_string(run_dir_path.join("config_snapshot.json")).map_err(|e| e.to_string())?;
    let config: serde_json::Value = serde_json::from_str(&config_raw).map_err(|e| e.to_string())?;
    let project_name = config
        .get("project_name")
        .and_then(|v| v.as_str())
        .unwrap_or("model")
        .replace(' ', "_");
    let version = run_dir_path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("run")
        .to_string();
    let export_dir =
        PathBuf::from(&destination_root).join(format!("{project_name}_{version}_flux1-schnell"));
    fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;

    let model_path =
        primary_safetensors_path(&run_dir_path).ok_or("No trained safetensors file found.")?;
    let model_file_name = Path::new(&model_path)
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or("Invalid safetensors file name.")?
        .to_string();

    let mut copied_files: Vec<String> = Vec::new();
    for relative in [
        "config_snapshot.json",
        "dataset_manifest.json",
        "dataset_config.toml",
        "kohya_config.toml",
        "training_log.txt",
        "sample_prompts.txt",
    ] {
        let src = run_dir_path.join(relative);
        if src.is_file() {
            let dest = export_dir.join(relative);
            fs::copy(&src, &dest).map_err(|e| e.to_string())?;
            copied_files.push(dest.to_string_lossy().to_string());
        }
    }

    let model_dest = export_dir.join(&model_file_name);
    fs::copy(Path::new(&model_path), &model_dest).map_err(|e| e.to_string())?;
    copied_files.push(model_dest.to_string_lossy().to_string());

    let dataset_dir = config
        .get("dataset_dir")
        .and_then(|v| v.as_str())
        .map(PathBuf::from)
        .ok_or("Missing dataset_dir in run config.")?;
    let dataset_export_dir = export_dir.join("dataset").join("images");
    copy_dataset_training_files(&dataset_dir, &dataset_export_dir, &mut copied_files)?;

    let model_sha = sha256_file_hex(&model_dest)?;
    let manifest_path = export_dir.join("filmclusive_export_manifest.json");
    let manifest = serde_json::json!({
        "schema_version": 1,
        "app_version": env!("CARGO_PKG_VERSION"),
        "exported_at": utc_now_iso(),
        "run_dir": run_dir,
        "project_name": config.get("project_name").and_then(|v| v.as_str()).unwrap_or(""),
        "preset_id": config.get("preset_id").and_then(|v| v.as_str()).unwrap_or(""),
        "base_model_id": "FLUX.1-schnell",
        "model_path": model_dest.to_string_lossy().to_string(),
        "model_sha256": model_sha,
        "copied_files": copied_files,
        "excluded_categories": ["base_models", "original_images"]
    });
    fs::write(
        &manifest_path,
        serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(ExportTrainingPackageResult {
        destination_root,
        export_dir: export_dir.to_string_lossy().to_string(),
        copied_files: manifest["copied_files"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        model_path: model_dest.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
    })
}
