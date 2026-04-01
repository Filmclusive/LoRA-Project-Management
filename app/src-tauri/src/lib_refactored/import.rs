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
use crate::lib_refactored::models::*;

fn collect_supported_images(path: &Path, out: &mut Vec<PathBuf>) {
    if path.is_file() {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if is_supported_image_ext(ext.as_str()) {
            out.push(path.to_path_buf());
        }
        return;
    }
    if !path.is_dir() {
        return;
    }
    let Ok(rd) = fs::read_dir(path) else {
        return;
    };
    for entry in rd.flatten() {
        let p = entry.path();
        if p.is_dir() {
            collect_supported_images(&p, out);
        } else if p.is_file() {
            let ext = p
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if is_supported_image_ext(ext.as_str()) {
                out.push(p);
            }
        }
    }
}

pub fn try_link_file(src: &Path, dest: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        fs::hard_link(src, dest).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::symlink;
        symlink(src, dest).map_err(|e| e.to_string())
    }
}

pub fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn import_images(
    app: tauri::AppHandle,
    project_id: Uuid,
    character_id: Uuid,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    import_images_with_mode(app, project_id, character_id, paths, "copy".to_string())
}

#[tauri::command]
pub fn import_images_with_mode(
    app: tauri::AppHandle,
    project_id: Uuid,
    character_id: Uuid,
    paths: Vec<String>,
    mode: String,
) -> Result<ImportResult, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let now = utc_now_iso();

    ensure_character_dirs(&root, project_id, character_id)?;
    let char_paths = character_paths(&root, project_id, character_id);

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

    let mut imported = 0u32;
    let mut skipped_duplicates = 0u32;
    let mut converted = 0u32;
    let mut failed = 0u32;
    let mut linked = 0u32;
    let mut failures = Vec::new();
    let is_link = mode.eq_ignore_ascii_case("link");

    let mut candidates: Vec<String> = Vec::new();
    for p in paths {
        let src = PathBuf::from(&p);
        if src.is_dir() {
            let mut collected: Vec<PathBuf> = Vec::new();
            collect_supported_images(&src, &mut collected);
            if collected.is_empty() {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: "No supported images found in folder.".to_string(),
                });
                continue;
            }
            for file in collected {
                candidates.push(file.to_string_lossy().to_string());
            }
            continue;
        }
        candidates.push(p);
    }

    for p in candidates {
        let src = PathBuf::from(&p);
        if !src.is_file() {
            failed += 1;
            failures.push(ImportFailure {
                source_path: p,
                reason: "File not found.".to_string(),
            });
            continue;
        }

        let sha = match sha256_file_hex(&src) {
            Ok(v) => v,
            Err(e) => {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: format!("Failed to read file: {e}"),
                });
                continue;
            }
        };

        let stem = &sha[..12];
        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let images_dir = PathBuf::from(&char_paths.images_dir);
        let originals_dir = PathBuf::from(&char_paths.originals_dir);
        let thumbs_dir = PathBuf::from(&char_paths.thumbs_dir);

        if has_prepared_image_for_stem(&images_dir, stem) {
            skipped_duplicates += 1;
            continue;
        }

        let orig_name = src
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("image");
        let dest_orig = originals_dir.join(format!("{stem}_{orig_name}"));

        if is_link {
            if let Err(e) = try_link_file(&src, &dest_orig) {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: format!("Link failed: {e}"),
                });
                continue;
            }
            linked += 1;
        } else if let Err(e) = fs::copy(&src, &dest_orig) {
            failed += 1;
            failures.push(ImportFailure {
                source_path: p,
                reason: format!("Copy failed: {e}"),
            });
            continue;
        }

        let prep_ext = if is_supported_image_ext(&ext) {
            ext.clone()
        } else {
            "png".to_string()
        };
        let dest_prep = images_dir.join(format!("{stem}.{prep_ext}"));

        if prep_ext == "png" && ext != "png" {
            if let Err(e) = run_sips_png(&dest_orig, &dest_prep) {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: format!("Image conversion failed: {e}"),
                });
                let _ = fs::remove_file(&dest_orig);
                continue;
            }
            converted += 1;
        } else if let Err(e) = fs::copy(&dest_orig, &dest_prep) {
            failed += 1;
            failures.push(ImportFailure {
                source_path: p,
                reason: format!("Preparation copy failed: {e}"),
            });
            let _ = fs::remove_file(&dest_orig);
            continue;
        }

        if let Some(sidecar) = find_caption_sidecar_for_image(&src) {
            let _ = try_import_caption_sidecar(&sidecar, &dest_prep.with_extension("txt"));
        }

        imported += 1;
    }

    character.image_count = fs::read_dir(&char_paths.images_dir)
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
    save_library(&root, &lib)?;

    Ok(ImportResult {
        imported,
        skipped_duplicates,
        converted,
        failed,
        linked,
        failures,
        notes: Vec::new(),
    })
}

#[tauri::command]
pub fn import_asset_images(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    import_asset_images_with_mode(app, project_id, asset_id, paths, "copy".to_string())
}

#[tauri::command]
pub fn import_asset_images_with_mode(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
    paths: Vec<String>,
    mode: String,
) -> Result<ImportResult, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let now = utc_now_iso();
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let source_character_id = project
        .assets
        .iter()
        .find(|a| a.id == asset_id)
        .ok_or("Asset not found.")?
        .source_character_id;

    if let Some(character_id) = source_character_id {
        return import_images_with_mode(app, project_id, character_id, paths, mode);
    }

    let asset_paths = ensure_asset_dirs(&root, &*project, asset_id)?;
    let mut imported = 0u32;
    let mut skipped_duplicates = 0u32;
    let mut converted = 0u32;
    let mut failed = 0u32;
    let mut linked = 0u32;
    let mut failures = Vec::new();
    let is_link = mode.eq_ignore_ascii_case("link");

    let mut candidates: Vec<String> = Vec::new();
    for p in paths {
        let src = PathBuf::from(&p);
        if src.is_dir() {
            let mut collected: Vec<PathBuf> = Vec::new();
            collect_supported_images(&src, &mut collected);
            if collected.is_empty() {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: "No supported images found in folder.".to_string(),
                });
                continue;
            }
            for file in collected {
                candidates.push(file.to_string_lossy().to_string());
            }
            continue;
        }
        candidates.push(p);
    }

    for p in candidates {
        let src = PathBuf::from(&p);
        if !src.is_file() {
            failed += 1;
            failures.push(ImportFailure {
                source_path: p,
                reason: "File not found.".to_string(),
            });
            continue;
        }

        let sha = match sha256_file_hex(&src) {
            Ok(v) => v,
            Err(e) => {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: format!("Failed to read file: {e}"),
                });
                continue;
            }
        };

        let stem = &sha[..12];
        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let images_dir = PathBuf::from(&asset_paths.images_dir);
        let originals_dir = PathBuf::from(&asset_paths.originals_dir);

        if has_prepared_image_for_stem(&images_dir, stem) {
            skipped_duplicates += 1;
            continue;
        }

        let orig_name = src
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("image");
        let dest_orig = originals_dir.join(format!("{stem}_{orig_name}"));

        if is_link {
            if let Err(e) = try_link_file(&src, &dest_orig) {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: format!("Link failed: {e}"),
                });
                continue;
            }
            linked += 1;
        } else if let Err(e) = fs::copy(&src, &dest_orig) {
            failed += 1;
            failures.push(ImportFailure {
                source_path: p,
                reason: format!("Copy failed: {e}"),
            });
            continue;
        }

        let prep_ext = if is_supported_image_ext(&ext) {
            ext.clone()
        } else {
            "png".to_string()
        };
        let dest_prep = images_dir.join(format!("{stem}.{prep_ext}"));

        if prep_ext == "png" && ext != "png" {
            if let Err(e) = run_sips_png(&dest_orig, &dest_prep) {
                failed += 1;
                failures.push(ImportFailure {
                    source_path: p,
                    reason: format!("Image conversion failed: {e}"),
                });
                let _ = fs::remove_file(&dest_orig);
                continue;
            }
            converted += 1;
        } else if let Err(e) = fs::copy(&dest_orig, &dest_prep) {
            failed += 1;
            failures.push(ImportFailure {
                source_path: p,
                reason: format!("Preparation copy failed: {e}"),
            });
            let _ = fs::remove_file(&dest_orig);
            continue;
        }

        if let Some(sidecar) = find_caption_sidecar_for_image(&src) {
            let _ = try_import_caption_sidecar(&sidecar, &dest_prep.with_extension("txt"));
        }

        imported += 1;
    }

    let asset = project
        .assets
        .iter_mut()
        .find(|a| a.id == asset_id)
        .ok_or("Asset not found.")?;
    asset.dataset_image_count = fs::read_dir(&asset_paths.images_dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter(|e| e.path().is_file())
                .count() as u32
        })
        .unwrap_or(0);
    asset.updated_at = now.clone();
    project.updated_at = now;
    save_library(&root, &lib)?;

    Ok(ImportResult {
        imported,
        skipped_duplicates,
        converted,
        failed,
        linked,
        failures,
        notes: Vec::new(),
    })
}

pub fn run_sips_png(src: &Path, out_png: &Path) -> Result<(), String> {
    // Note: I'll use image crate if available or sips on macOS.
    // For now, I'll assume the original code used image crate as seen in previous grep.
    // Let's check imports in original lib.rs for 'image'.
    let dyn_img = image::open(src).map_err(|e| format!("Could not decode image: {e}"))?;
    dyn_img
        .save_with_format(out_png, image::ImageFormat::Png)
        .map_err(|e| format!("Could not write PNG: {e}"))?;
    Ok(())
}

pub fn has_prepared_image_for_stem(images_dir: &Path, stem: &str) -> bool {
    let PREPARED_IMAGE_EXTS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];
    PREPARED_IMAGE_EXTS
        .iter()
        .any(|ext| images_dir.join(format!("{stem}.{ext}")).exists())
}

#[tauri::command]
pub fn import_lora(
    app: tauri::AppHandle,
    project_id: Uuid,
    asset_id: Uuid,
    source_path: String,
    name: Option<String>,
) -> Result<AssetModelSummary, String> {
    let root = library_root(&app)?;
    let mut lib = load_library(&root)?;
    let project = lib
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or("Project not found.")?;
    let paths = ensure_asset_dirs(&root, &*project, asset_id)?;
    let asset = project
        .assets
        .iter()
        .find(|a| a.id == asset_id)
        .ok_or("Asset not found.")?;

    let src = PathBuf::from(&source_path);
    if !src.is_file() {
        return Err("Source file not found.".to_string());
    }

    let file_name = src
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid source file name.")?;
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("model");
    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("safetensors");

    let dest_name = if let Some(n) = name {
        format!("{n}.{ext}")
    } else {
        file_name.to_string()
    };
    let dest_path = PathBuf::from(&paths.imports_dir).join(&dest_name);
    fs::copy(&src, &dest_path).map_err(|e| e.to_string())?;

    let model_id = format!("import:{}", Uuid::new_v4());
    let meta_path = dest_path.with_extension("json");
    let now = utc_now_iso();
    let meta = serde_json::json!({
        "id": model_id,
        "asset_id": asset_id,
        "name": dest_name,
        "version": "imported",
        "trained_at": now,
        "status": "Imported",
        "model_path": dest_path.to_string_lossy().to_string(),
        "source_path": source_path,
        "engine_key": "import",
        "model_family": asset.model_family,
        "trigger_tokens": asset.trigger_tokens,
    });
    write_json_file(&meta_path, &meta)?;

    let artifacts = vec![artifacts_for_path(&dest_path, Some(&meta_path), Some(source_path))];
    Ok(AssetModelSummary {
        id: model_id,
        asset_id,
        name: dest_name,
        version: "imported".to_string(),
        trained_at: Some(now),
        status: "Imported".to_string(),
        run_dir: None,
        engine_key: "import".to_string(),
        imported: true,
        model_family: asset.model_family.clone(),
        trigger_tokens: asset.trigger_tokens.clone(),
        artifacts,
    })
}
