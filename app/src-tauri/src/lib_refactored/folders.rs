use uuid::Uuid;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::library_management::*;

#[tauri::command]
pub fn list_folders(app: tauri::AppHandle, project_id: Uuid) -> Result<Vec<FolderSummary>, String> {
    let root = library_root(&app)?;
    let lib = load_library(&root)?;
    let project = lib
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    Ok(project
        .folders
        .iter()
        .map(|f| FolderSummary {
            id: f.id,
            parent_id: f.parent_id,
            name: f.name.clone(),
            key: f.key.clone(),
            kind: f.kind.clone(),
            order: f.order,
            pinned: f.pinned,
            asset_count: project
                .assets
                .iter()
                .filter(|a| a.folder_id == f.id)
                .count() as u32,
        })
        .collect())
}

#[tauri::command]
pub fn create_folder(
    app: tauri::AppHandle,
    project_id: Uuid,
    parent_id: Option<Uuid>,
    name: String,
) -> Result<FolderNode, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let folder = FolderNode {
        id: Uuid::new_v4(),
        parent_id,
        name: name.clone(),
        key: folder_key(&name),
        kind: "folder".to_string(),
        order: (project
            .folders
            .iter()
            .filter(|f| f.parent_id == parent_id)
            .map(|f| f.order)
            .max()
            .unwrap_or(-1)
            + 1),
        pinned: false,
    };
    project.folders.push(folder.clone());
    project.updated_at = utc_now_iso();
    save_library(&root, &lib)?;
    Ok(folder)
}

#[tauri::command]
pub fn update_folder(
    app: tauri::AppHandle,
    project_id: Uuid,
    folder_id: Uuid,
    name: String,
) -> Result<FolderNode, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let folder = project
        .folders
        .iter_mut()
        .find(|f| f.id == folder_id)
        .ok_or("Folder not found.")?;
    folder.name = name.clone();
    folder.key = folder_key(&name);
    project.updated_at = utc_now_iso();
    let updated = folder.clone();
    save_library(&root, &lib)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_folder(app: tauri::AppHandle, project_id: Uuid, folder_id: Uuid) -> Result<bool, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    if project.assets.iter().any(|a| a.folder_id == folder_id) {
        return Err("Cannot delete folder that contains assets.".to_string());
    }
    if project.folders.iter().any(|f| f.parent_id == Some(folder_id)) {
        return Err("Cannot delete folder that contains other folders.".to_string());
    }
    project.folders.retain(|f| f.id != folder_id);
    project.updated_at = utc_now_iso();
    save_library(&root, &lib)?;
    Ok(true)
}
