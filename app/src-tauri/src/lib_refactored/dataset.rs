use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::library_management::*;
use crate::lib_refactored::assets::*;
use crate::lib_refactored::characters::*;
use crate::lib_refactored::captions::*;

#[derive(serde::Serialize, serde::Deserialize, Debug, Default)]
struct ImageCategoriesFile {
    schema_version: u32,
    categories: std::collections::HashMap<String, String>,
}

fn image_categories_path(dataset_dir: &Path) -> PathBuf {
    dataset_dir.join(".filmclusive").join("image_categories.json")
}

fn load_image_categories(dataset_dir: &Path) -> Result<ImageCategoriesFile, String> {
    let path = image_categories_path(dataset_dir);
    if !path.exists() {
        return Ok(ImageCategoriesFile {
            schema_version: 1,
            categories: std::collections::HashMap::new(),
        });
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<ImageCategoriesFile>(&raw).map_err(|e| e.to_string())
}

fn save_image_categories(dataset_dir: &Path, file: &ImageCategoriesFile) -> Result<(), String> {
    let path = image_categories_path(dataset_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_dataset_images(
    dataset_dir: String,
    thumbs_dir: Option<String>,
    originals_dir: Option<String>,
) -> Result<Vec<DatasetImageEntry>, String> {
    let dir = PathBuf::from(dataset_dir);
    if !dir.is_dir() {
        return Err("Dataset directory not found.".to_string());
    }

    let thumbs = thumbs_dir.map(PathBuf::from).filter(|p| p.is_dir());
    let originals = originals_dir.map(PathBuf::from).filter(|p| p.is_dir());

    let mut original_name_by_stem: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut original_path_by_stem: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    if let Some(orig_dir) = originals.as_ref() {
        if let Ok(rd) = fs::read_dir(orig_dir) {
            for e in rd.flatten() {
                let p = e.path();
                if !p.is_file() {
                    continue;
                }
                let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                    continue;
                };
                let Some((stem, rest)) = name.split_once('_') else {
                    continue;
                };
                if stem.len() != 12 {
                    continue;
                }
                original_name_by_stem
                    .entry(stem.to_string())
                    .or_insert_with(|| rest.to_string());
                original_path_by_stem
                    .entry(stem.to_string())
                    .or_insert_with(|| p.to_string_lossy().to_string());
            }
        }
    }

    let mut out: Vec<DatasetImageEntry> = Vec::new();

    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !is_supported_image_ext(ext.as_str()) {
            continue;
        }

        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(v) => v.to_string(),
            None => continue,
        };

        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let display_name = original_name_by_stem
            .get(&stem)
            .cloned()
            .unwrap_or_else(|| file_name.clone());
        let original_path = original_path_by_stem.get(&stem).cloned();

        let caption_path = path.with_extension("txt");
        let has_caption = caption_path.exists();

        let thumb_path = thumbs.as_ref().and_then(|thumbs_dir| {
            let candidate = thumbs_dir.join(format!("{stem}.png"));
            if candidate.exists() {
                Some(candidate.to_string_lossy().to_string())
            } else {
                None
            }
        });

        out.push(DatasetImageEntry {
            file_name,
            display_name,
            image_path: path.to_string_lossy().to_string(),
            thumb_path,
            original_path,
            caption_path: caption_path.to_string_lossy().to_string(),
            has_caption,
        });
    }

    out.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(out)
}

#[tauri::command]
pub fn read_image_categories(dataset_dir: String) -> Result<std::collections::HashMap<String, String>, String> {
    let dir = PathBuf::from(dataset_dir);
    if !dir.is_dir() {
        return Err("Dataset directory not found.".to_string());
    }
    let file = load_image_categories(&dir)?;
    Ok(file.categories)
}

#[tauri::command]
pub fn set_image_category(dataset_dir: String, file_name: String, category: Option<String>) -> Result<bool, String> {
    validate_dataset_file_name(file_name.as_str())?;
    let dir = PathBuf::from(dataset_dir);
    if !dir.is_dir() {
        return Err("Dataset directory not found.".to_string());
    }
    let mut file = load_image_categories(&dir)?;
    let next = category.unwrap_or_default().trim().to_string();
    if next.is_empty() {
        file.categories.remove(&file_name);
    } else {
        file.categories.insert(file_name, next);
    }
    save_image_categories(&dir, &file)?;
    Ok(true)
}

#[tauri::command]
pub fn delete_character_image(
    app: tauri::AppHandle,
    project_id: Uuid,
    character_id: Uuid,
    file_name: String,
) -> Result<serde_json::Value, String> {
    validate_dataset_file_name(file_name.as_str())?;
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let now = utc_now_iso();

    ensure_character_dirs(&root, project_id, character_id)?;
    let paths = character_paths(&root, project_id, character_id);

    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let character = project
        .characters
        .iter_mut()
        .find(|c| c.id == character_id)
        .ok_or("Character not found.")?;

    let images_dir = PathBuf::from(&paths.images_dir);
    let thumbs_dir = PathBuf::from(&paths.thumbs_dir);
    let originals_dir = PathBuf::from(&paths.originals_dir);

    let img = images_dir.join(&file_name);
    if !img.is_file() {
        return Err("Image not found.".to_string());
    }

    let stem = img
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let _ = fs::remove_file(&img);
    let _ = fs::remove_file(img.with_extension("txt"));
    let _ = fs::remove_file(thumbs_dir.join(format!("{stem}.png")));
    let _ = set_image_category(paths.images_dir.clone(), file_name.clone(), None);

    if originals_dir.is_dir() {
        if let Ok(rd) = fs::read_dir(&originals_dir) {
            for e in rd.flatten() {
                let p = e.path();
                if !p.is_file() {
                    continue;
                }
                let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                    continue;
                };
                if name.starts_with(&format!("{stem}_")) {
                    let _ = fs::remove_file(&p);
                }
            }
        }
    }

    character.image_count = fs::read_dir(&paths.images_dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter(|e| e.path().is_file())
                .count() as u32
        })
        .unwrap_or(0);
    character.updated_at = now.clone();
    if let Some(asset) = project
        .assets
        .iter_mut()
        .find(|asset| asset.source_character_id == Some(character_id))
    {
        asset.dataset_image_count = character.image_count;
        asset.updated_at = now.clone();
    }
    project.updated_at = now;
    let image_count = character.image_count;
    save_library(&root, &lib)?;

    Ok(serde_json::json!({ "image_count": image_count }))
}

#[tauri::command]
pub fn delete_asset_image(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
    file_name: String,
) -> Result<serde_json::Value, String> {
    validate_dataset_file_name(file_name.as_str())?;
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let now = utc_now_iso();
    let project = lib
        .projects
        .iter_mut()
        .find(|project| project.id == project_id)
        .ok_or("Project not found.")?;
    let paths = ensure_asset_dirs(&root, project, asset_id)?;
    let asset = project
        .assets
        .iter_mut()
        .find(|asset| asset.id == asset_id)
        .ok_or("Asset not found.")?;

    let images_dir = PathBuf::from(&paths.images_dir);
    let thumbs_dir = PathBuf::from(&paths.thumbs_dir);
    let originals_dir = PathBuf::from(&paths.originals_dir);
    let img = images_dir.join(&file_name);
    if !img.is_file() {
        return Err("Image not found.".to_string());
    }

    let stem = img
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string();
    let _ = fs::remove_file(&img);
    let _ = fs::remove_file(img.with_extension("txt"));
    let _ = fs::remove_file(thumbs_dir.join(format!("{stem}.png")));
    let _ = set_image_category(paths.images_dir.clone(), file_name.clone(), None);

    if originals_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&originals_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let name = path
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("");
                    if name.starts_with(&format!("{stem}_")) {
                        let _ = fs::remove_file(&path);
                    }
                }
            }
        }
    }

    asset.dataset_image_count = fs::read_dir(&paths.images_dir)
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok())
                .filter(|entry| entry.path().is_file())
                .count() as u32
        })
        .unwrap_or(asset.dataset_image_count);
    asset.updated_at = now.clone();
    if let Some(character_id) = asset.source_character_id {
        if let Some(character) = project
            .characters
            .iter_mut()
            .find(|character| character.id == character_id)
        {
            character.image_count = asset.dataset_image_count;
            character.updated_at = now.clone();
        }
    }
    project.updated_at = now;
    let image_count = asset.dataset_image_count;
    save_library(&root, &lib)?;
    Ok(serde_json::json!({ "image_count": image_count }))
}

#[tauri::command]
pub fn delete_asset(app: tauri::AppHandle, project_id: Uuid, asset_id: Uuid) -> Result<bool, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|project| project.id == project_id)
        .ok_or("Project not found.")?;
    let source_character_id = {
        let asset = project
            .assets
            .iter()
            .find(|asset| asset.id == asset_id)
            .ok_or("Asset not found.")?;
        asset.source_character_id
    };
    let now = utc_now_iso();
    let asset_root = asset_dir(&root, project_id, asset_id);
    let character_root = source_character_id.map(|character_id| character_dir(&root, project_id, character_id));

    let _ = fs::remove_dir_all(&asset_root);
    if let Some(char_root) = &character_root {
        let _ = fs::remove_dir_all(char_root);
    }

    project.assets.retain(|asset| asset.id != asset_id);
    if let Some(character_id) = source_character_id {
        project.characters.retain(|character| character.id != character_id);
    }
    project.updated_at = now;
    save_library(&root, &lib)?;
    Ok(true)
}
