use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::library_management::*;
use crate::lib_refactored::assets::*;

pub fn character_paths(root: &Path, project_id: Uuid, character_id: Uuid) -> CharacterPaths {
    let base = character_dir(root, project_id, character_id);
    CharacterPaths {
        dataset_dir: base.join("dataset").to_string_lossy().to_string(),
        originals_dir: base.join("originals").to_string_lossy().to_string(),
        images_dir: base.join("dataset").join("images").to_string_lossy().to_string(),
        thumbs_dir: base.join("dataset").join("thumbs").to_string_lossy().to_string(),
        runs_root: base.join("runs").to_string_lossy().to_string(),
    }
}

pub fn ensure_character_dirs(root: &Path, project_id: Uuid, character_id: Uuid) -> Result<(), String> {
    let p = character_paths(root, project_id, character_id);
    fs::create_dir_all(&p.originals_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&p.images_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&p.thumbs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&p.runs_root).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_characters(app: tauri::AppHandle, project_id: Uuid) -> Result<Vec<CharacterSummary>, String> {
    let root = library_root(&app)?;
    let lib = load_library(&root)?;
    let project = lib
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    Ok(project
        .characters
        .iter()
        .map(|c| CharacterSummary {
            id: c.id,
            name: c.name.clone(),
            updated_at: c.updated_at.clone(),
            image_count: c.image_count,
        })
        .collect())
}

#[tauri::command]
pub fn create_character(app: tauri::AppHandle, project_id: Uuid, name: String) -> Result<Character, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let now = utc_now_iso();
    let character = Character {
        id: Uuid::new_v4(),
        name,
        created_at: now.clone(),
        updated_at: now,
        image_count: 0,
    };
    project.characters.push(character.clone());
    ensure_project_library(project);
    project.updated_at = utc_now_iso();
    save_library(&root, &lib)?;
    Ok(character)
}

#[tauri::command]
pub fn get_character_paths(
    app: tauri::AppHandle,
    project_id: Uuid,
    character_id: Uuid,
) -> Result<CharacterPaths, String> {
    let root = library_root(&app)?;
    Ok(character_paths(&root, project_id, character_id))
}
