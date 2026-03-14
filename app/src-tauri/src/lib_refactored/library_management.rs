use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;

pub fn load_library(root: &Path) -> Result<Library, String> {
    let path = library_path(root);
    if !path.exists() {
        let (lib, _) = migrate_library(Library {
            schema_version: 1,
            projects: Vec::new(),
        });
        return Ok(lib);
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let lib: Library = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let (migrated, changed) = migrate_library(lib);
    if changed {
        if let Err(err) = save_library(root, &migrated) {
            eprintln!("Failed to persist library migration: {err}");
        }
    }
    Ok(migrated)
}

pub fn save_library(root: &Path, lib: &Library) -> Result<(), String> {
    let path = library_path(root);
    let raw = serde_json::to_string_pretty(lib).map_err(|e| e.to_string())?;
    fs::write(path, format!("{raw}\n")).map_err(|e| e.to_string())
}

pub fn folder_key(name: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in name.chars() {
        let lowered = ch.to_ascii_lowercase();
        if lowered.is_ascii_alphanumeric() {
            out.push(lowered);
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

pub fn add_folder(
    folders: &mut Vec<FolderNode>,
    parent_id: Option<Uuid>,
    name: &str,
    key: &str,
    kind: &str,
    order: i32,
) -> Uuid {
    let id = Uuid::new_v4();
    folders.push(FolderNode {
        id,
        parent_id,
        name: name.to_string(),
        key: key.to_string(),
        kind: kind.to_string(),
        order,
        pinned: kind == "department",
    });
    id
}

pub fn build_default_folder_tree() -> Vec<FolderNode> {
    let mut folders = Vec::new();
    let actors = add_folder(&mut folders, None, "Characters", "actors", "department", 0);
    let art = add_folder(
        &mut folders,
        None,
        "Art Department",
        "art-department",
        "department",
        1,
    );
    add_folder(&mut folders, Some(art), "Sets", "sets", "folder", 0);
    add_folder(&mut folders, Some(art), "Props", "props", "folder", 1);
    add_folder(&mut folders, Some(art), "Wardrobe", "wardrobe", "folder", 2);
    add_folder(&mut folders, Some(art), "Vehicles", "vehicles", "folder", 3);
    add_folder(&mut folders, Some(art), "Animals", "animals", "folder", 4);
    
    let camera = add_folder(&mut folders, None, "Camera & Lighting", "camera-lighting", "department", 2);
    add_folder(&mut folders, Some(camera), "Lenses", "lenses", "folder", 0);
    add_folder(&mut folders, Some(camera), "Lighting Styles", "lighting-styles", "folder", 1);
    add_folder(&mut folders, Some(camera), "Film Stock", "film-stock", "folder", 2);

    add_folder(&mut folders, None, "Locations", "locations", "department", 3);
    add_folder(&mut folders, None, "VFX / CGI", "vfx-cgi", "department", 4);
    add_folder(&mut folders, None, "Storyboards", "storyboards", "department", 5);
    add_folder(&mut folders, None, "Reference", "reference", "department", 6);
    add_folder(&mut folders, None, "Production", "production", "department", 7);
    add_folder(&mut folders, None, "Graphics / Titles", "graphics-titles", "department", 8);
    add_folder(&mut folders, None, "Custom", "custom", "department", 9);
    add_folder(&mut folders, None, "Imported", "imported", "department", 10);
    
    let _ = actors;
    folders
}

pub fn folder_id_by_key(project: &Project, key: &str) -> Option<Uuid> {
    project
        .folders
        .iter()
        .find(|folder| folder.key == key)
        .map(|folder| folder.id)
}

pub fn ensure_project_library(project: &mut Project) -> bool {
    let mut changed = false;

    if project.folders.is_empty() {
        project.folders = build_default_folder_tree();
        changed = true;
    }

    for folder in &mut project.folders {
        if folder.key.trim().is_empty() {
            folder.key = folder_key(&folder.name);
            changed = true;
        }
    }

    for folder in &mut project.folders {
        if folder.key == "actors" && folder.name == "Actors" {
            folder.name = "Characters".to_string();
            changed = true;
        }
    }

    let actors_folder_id = folder_id_by_key(project, "actors")
        .or_else(|| {
            project
                .folders
                .iter()
                .find(|folder| folder.kind == "department" && folder.name == "Characters")
                .map(|folder| folder.id)
        })
        .or_else(|| project.folders.first().map(|folder| folder.id))
        .unwrap_or_else(Uuid::new_v4);

    for character in &project.characters {
        if let Some(asset) = project.assets.iter_mut().find(|asset| {
            asset.source_character_id == Some(character.id) || asset.id == character.id
        }) {
            if asset.folder_id != actors_folder_id {
                asset.folder_id = actors_folder_id;
                changed = true;
            }
            if asset.source_character_id != Some(character.id) {
                asset.source_character_id = Some(character.id);
                changed = true;
            }
            if asset.asset_type != "actor" {
                asset.asset_type = "actor".to_string();
                changed = true;
            }
            if asset.model_family.trim().is_empty() {
                asset.model_family = "sdxl".to_string();
                changed = true;
            }
            if asset.trigger_tokens.is_empty() {
                asset.trigger_tokens = vec![folder_key(&character.name)];
                changed = true;
            }
            if asset.dataset_image_count != character.image_count {
                asset.dataset_image_count = character.image_count;
                changed = true;
            }
        } else {
            project.assets.push(Asset {
                id: character.id,
                name: character.name.clone(),
                asset_type: "actor".to_string(),
                folder_id: actors_folder_id,
                model_family: "sdxl".to_string(),
                created_at: character.created_at.clone(),
                updated_at: character.updated_at.clone(),
                dataset_image_count: character.image_count,
                tags: Vec::new(),
                trigger_tokens: vec![folder_key(&character.name)],
                notes: String::new(),
                training_steps_override: None,
                source_character_id: Some(character.id),
            });
            changed = true;
        }
    }

    changed
}

pub fn migrate_library(mut lib: Library) -> (Library, bool) {
    let mut changed = false;
    if lib.schema_version < 2 {
        lib.schema_version = 2;
        changed = true;
    }
    for project in &mut lib.projects {
        if ensure_project_library(project) {
            changed = true;
        }
    }
    (lib, changed)
}
