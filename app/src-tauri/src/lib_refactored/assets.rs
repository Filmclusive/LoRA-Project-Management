use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::library_management::*;
use crate::lib_refactored::models::*;

pub fn asset_dir(root: &Path, project_id: Uuid, asset_id: Uuid) -> PathBuf {
    root.join("projects")
        .join(project_id.to_string())
        .join("assets")
        .join(asset_id.to_string())
}

pub fn asset_paths(root: &Path, project: &Project, asset_id: Uuid) -> Result<AssetPaths, String> {
    let asset = project
        .assets
        .iter()
        .find(|a| a.id == asset_id)
        .ok_or("Asset not found.")?;
    let (asset_root, uses_character_storage) = if let Some(character_id) = asset.source_character_id {
        (character_dir(root, project.id, character_id), true)
    } else {
        (asset_dir(root, project.id, asset_id), false)
    };

    Ok(AssetPaths {
        asset_root: asset_root.to_string_lossy().to_string(),
        dataset_dir: asset_root.join("dataset").to_string_lossy().to_string(),
        originals_dir: asset_root.join("originals").to_string_lossy().to_string(),
        images_dir: asset_root.join("dataset").join("images").to_string_lossy().to_string(),
        thumbs_dir: asset_root.join("dataset").join("thumbs").to_string_lossy().to_string(),
        runs_root: asset_root.join("runs").to_string_lossy().to_string(),
        imports_dir: asset_root.join("imports").to_string_lossy().to_string(),
        uses_character_storage,
    })
}

pub fn ensure_asset_dirs(root: &Path, project: &Project, asset_id: Uuid) -> Result<AssetPaths, String> {
    let paths = asset_paths(root, project, asset_id)?;
    fs::create_dir_all(&paths.originals_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&paths.images_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&paths.thumbs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&paths.runs_root).map_err(|e| e.to_string())?;
    fs::create_dir_all(&paths.imports_dir).map_err(|e| e.to_string())?;
    Ok(paths)
}

#[tauri::command]
pub fn list_assets(app: tauri::AppHandle, project_id: Uuid) -> Result<Vec<AssetSummary>, String> {
    let root = library_root(&app)?;
    let lib = load_library(&root)?;
    let project = lib
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    Ok(project
        .assets
        .iter()
        .map(|a| build_asset_summary(&root, project, a))
        .collect())
}

#[tauri::command]
pub fn create_asset(
    app: tauri::AppHandle,
    project_id: Uuid,
    name: String,
    asset_type: String,
    folder_id: Uuid,
    model_family: String,
) -> Result<Asset, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let now = utc_now_iso();
    let asset = Asset {
        id: Uuid::new_v4(),
        name,
        asset_type,
        folder_id,
        model_family,
        created_at: now.clone(),
        updated_at: now,
        dataset_image_count: 0,
        tags: Vec::new(),
        trigger_tokens: Vec::new(),
        notes: String::new(),
        training_steps_override: None,
        source_character_id: None,
    };
    project.assets.push(asset.clone());
    project.updated_at = utc_now_iso();
    save_library(&root, &lib)?;
    Ok(asset)
}

#[tauri::command]
pub fn update_asset(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
    name: Option<String>,
    folder_id: Option<Uuid>,
    tags: Option<Vec<String>>,
    trigger_tokens: Option<Vec<String>>,
    notes: Option<String>,
    training_steps_override: Option<u32>,
) -> Result<Asset, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let asset = project
        .assets
        .iter_mut()
        .find(|a| a.id == asset_id)
        .ok_or("Asset not found.")?;
    if let Some(v) = name {
        asset.name = v;
    }
    if let Some(v) = folder_id {
        asset.folder_id = v;
    }
    if let Some(v) = tags {
        asset.tags = v;
    }
    if let Some(v) = trigger_tokens {
        asset.trigger_tokens = v;
    }
    if let Some(v) = notes {
        asset.notes = v;
    }
    asset.training_steps_override = training_steps_override;
    asset.updated_at = utc_now_iso();
    project.updated_at = utc_now_iso();
    let updated = asset.clone();
    save_library(&root, &lib)?;
    Ok(updated)
}

#[tauri::command]
pub fn get_asset_paths(app: tauri::AppHandle, project_id: Uuid, asset_id: Uuid) -> Result<AssetPaths, String> {
    let root = library_root(&app)?;
    let lib = load_library(&root)?;
    let project = lib
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    asset_paths(&root, project, asset_id)
}

#[tauri::command]
pub fn list_asset_models(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
) -> Result<Vec<AssetModelSummary>, String> {
    let root = library_root(&app)?;
    let lib = load_library(&root)?;
    let project = lib
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let asset = project
        .assets
        .iter()
        .find(|a| a.id == asset_id)
        .ok_or("Asset not found.")?;
    list_asset_model_summaries(&root, project, asset)
}

pub fn character_dir(root: &Path, project_id: Uuid, character_id: Uuid) -> PathBuf {
    root.join("projects")
        .join(project_id.to_string())
        .join("characters")
        .join(character_id.to_string())
}
