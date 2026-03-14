use std::fs;
use uuid::Uuid;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::library_management::*;

#[tauri::command]
pub fn list_projects(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, String> {
    let root = library_root(&app)?;
    let lib = load_library(&root)?;
    Ok(lib
        .projects
        .iter()
        .map(|p| ProjectSummary {
            id: p.id,
            name: p.name.clone(),
            updated_at: p.updated_at.clone(),
            asset_count: (p.assets.len() + p.characters.len()) as u32,
            character_count: p.characters.len() as u32,
        })
        .collect())
}

#[tauri::command]
pub fn create_project(app: tauri::AppHandle, name: String) -> Result<ProjectSummary, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let now = utc_now_iso();
    let project = Project {
        id: Uuid::new_v4(),
        name,
        created_at: now.clone(),
        updated_at: now.clone(),
        folders: build_default_folder_tree(),
        assets: Vec::new(),
        characters: Vec::new(),
    };
    lib.projects.push(project.clone());
    save_library(&root, &lib)?;
    Ok(ProjectSummary {
        id: project.id,
        name: project.name,
        updated_at: project.updated_at,
        asset_count: 0,
        character_count: 0,
    })
}

#[tauri::command]
pub fn delete_project(app: tauri::AppHandle, project_id: Uuid) -> Result<bool, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;

    let before = lib.projects.len();
    lib.projects.retain(|p| p.id != project_id);
    if lib.projects.len() == before {
        return Err("Project not found.".to_string());
    }

    let project_root = root.join("projects").join(project_id.to_string());
    let _ = fs::remove_dir_all(&project_root);

    save_library(&root, &lib)?;
    Ok(true)
}

#[tauri::command]
pub fn rename_project(app: tauri::AppHandle, project_id: Uuid, name: String) -> Result<ProjectSummary, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let trimmed = safe_project_name(&name);
    if trimmed.trim().is_empty() {
        return Err("Project name cannot be empty.".to_string());
    }

    let now = utc_now_iso();
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    project.name = trimmed;
    project.updated_at = now;

    let summary = ProjectSummary {
        id: project.id,
        name: project.name.clone(),
        updated_at: project.updated_at.clone(),
        asset_count: (project.assets.len() + project.characters.len()) as u32,
        character_count: project.characters.len() as u32,
    };

    save_library(&root, &lib)?;
    Ok(summary)
}
