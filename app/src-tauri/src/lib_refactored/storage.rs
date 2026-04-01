use std::path::{Path, PathBuf};
use std::fs;
use serde::Serialize;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::library_management::*;

#[derive(Debug, Serialize, Clone)]
pub struct StorageStats {
    pub bytes: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub truncated: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct StorageCounts {
    pub projects: u32,
    pub characters: u32,
}

#[derive(Debug, Serialize, Clone)]
pub struct StorageReport {
    pub root: String,
    pub settings_path: String,
    pub library_path: String,
    pub projects_root: String,
    pub counts: StorageCounts,
    pub stats_root: StorageStats,
    pub stats_projects: StorageStats,
}

pub fn dir_stats(path: &Path, entry_limit: usize) -> StorageStats {
    let mut bytes: u64 = 0;
    let mut file_count: u64 = 0;
    let mut dir_count: u64 = 0;
    let mut truncated = false;
    let mut seen: usize = 0;
    let mut stack: Vec<PathBuf> = vec![path.to_path_buf()];

    while let Some(dir) = stack.pop() {
        if seen >= entry_limit {
            truncated = true;
            break;
        }
        let rd = match fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };
        for entry in rd.flatten() {
            seen += 1;
            if seen >= entry_limit {
                truncated = true;
                break;
            }
            let p = entry.path();
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    dir_count += 1;
                    stack.push(p);
                } else {
                    file_count += 1;
                    bytes += meta.len();
                }
            }
        }
        if truncated {
            break;
        }
    }

    StorageStats {
        bytes,
        file_count,
        dir_count,
        truncated,
    }
}

#[tauri::command]
pub fn storage_report(app: tauri::AppHandle) -> Result<StorageReport, String> {
    let root = library_root(&app)?;
    let lib = load_library(&root)?;
    let projects_root = root.join("projects");

    let counts = StorageCounts {
        projects: lib.projects.len() as u32,
        characters: lib
            .projects
            .iter()
            .map(|p| p.characters.len() as u32)
            .sum::<u32>(),
    };

    let stats_root = dir_stats(&root, 5000);
    let stats_projects = if projects_root.is_dir() {
        dir_stats(&projects_root, 5000)
    } else {
        StorageStats {
            bytes: 0,
            file_count: 0,
            dir_count: 0,
            truncated: false,
        }
    };

    Ok(StorageReport {
        root: root.to_string_lossy().to_string(),
        settings_path: settings_path(&root).to_string_lossy().to_string(),
        library_path: library_path(&root).to_string_lossy().to_string(),
        projects_root: projects_root.to_string_lossy().to_string(),
        counts,
        stats_root,
        stats_projects,
    })
}
