mod bootstrap;
mod caption;
mod config;
mod eval;
mod system;
mod training;

// `lib_refactored/*` is compiled as top-level modules via `#[path = ...]` below.
// Some refactored files still use the older `crate::lib_refactored::*` paths.
// Provide a small compatibility module to avoid touching every file.
pub mod lib_refactored {
    pub mod types {
        pub use crate::types::*;
        pub use crate::library_types::*;
        pub use crate::model_types::*;
        pub use crate::event_types::*;
    }
    pub mod paths { pub use crate::paths::*; }
    pub mod utils { pub use crate::utils::*; }
    pub mod models { pub use crate::models::*; }
    pub mod settings { pub use crate::settings::*; }
    pub mod engine_management { pub use crate::engine_management::*; }
    pub mod library_management { pub use crate::library_management::*; }
    pub mod projects { pub use crate::projects::*; }
    pub mod folders { pub use crate::folders::*; }
    pub mod assets { pub use crate::assets::*; }
    pub mod characters { pub use crate::characters::*; }
    pub mod import { pub use crate::import::*; }
    pub mod captions { pub use crate::captions::*; }
    pub mod dataset { pub use crate::dataset::*; }
    pub mod training_commands { pub use crate::training_commands::*; }
    pub mod storage { pub use crate::storage::*; }
    pub mod export { pub use crate::export::*; }
    pub mod presets { pub use crate::presets::*; }
    pub mod downloads { pub use crate::downloads::*; }
    pub mod kohya_configs { pub use crate::kohya_configs::*; }
    pub mod sd_scripts { pub use crate::sd_scripts::*; }
    pub mod gpu { pub use crate::gpu::*; }
    pub mod python_utils { pub use crate::python_utils::*; }
    pub mod library_types { pub use crate::library_types::*; }
    pub mod model_types { pub use crate::model_types::*; }
    pub mod event_types { pub use crate::event_types::*; }
    pub mod engine_report { pub use crate::engine_report::*; }
    pub mod engine_setup { pub use crate::engine_setup::*; }
}

#[path = "lib_refactored/types.rs"]
pub mod types;
#[path = "lib_refactored/paths.rs"]
pub mod paths;
#[path = "lib_refactored/utils.rs"]
pub mod utils;
#[path = "lib_refactored/models.rs"]
pub mod models;
#[path = "lib_refactored/settings.rs"]
pub mod settings;
#[path = "lib_refactored/engine_management.rs"]
pub mod engine_management;
#[path = "lib_refactored/library_management.rs"]
pub mod library_management;
#[path = "lib_refactored/projects.rs"]
pub mod projects;
#[path = "lib_refactored/folders.rs"]
pub mod folders;
#[path = "lib_refactored/assets.rs"]
pub mod assets;
#[path = "lib_refactored/characters.rs"]
pub mod characters;
#[path = "lib_refactored/import.rs"]
pub mod import;
#[path = "lib_refactored/captions.rs"]
pub mod captions;
#[path = "lib_refactored/dataset.rs"]
pub mod dataset;
#[path = "lib_refactored/training_commands.rs"]
pub mod training_commands;
#[path = "lib_refactored/storage.rs"]
pub mod storage;
#[path = "lib_refactored/export.rs"]
pub mod export;
#[path = "lib_refactored/presets.rs"]
pub mod presets;
#[path = "lib_refactored/downloads.rs"]
pub mod downloads;
#[path = "lib_refactored/kohya_configs.rs"]
pub mod kohya_configs;
#[path = "lib_refactored/sd_scripts.rs"]
pub mod sd_scripts;
#[path = "lib_refactored/gpu.rs"]
pub mod gpu;
#[path = "lib_refactored/python_utils.rs"]
pub mod python_utils;
#[path = "lib_refactored/library_types.rs"]
pub mod library_types;
#[path = "lib_refactored/model_types.rs"]
pub mod model_types;
#[path = "lib_refactored/event_types.rs"]
pub mod event_types;
#[path = "lib_refactored/engine_report.rs"]
pub mod engine_report;
#[path = "lib_refactored/engine_setup.rs"]
pub mod engine_setup;

pub use types::*;
pub use paths::*;
pub use utils::*;
pub use models::*;
pub use settings::*;
pub use engine_management::*;
pub use library_management::*;
pub use projects::*;
pub use folders::*;
pub use assets::*;
pub use characters::*;
pub use import::*;
pub use captions::*;
pub use dataset::*;
pub use training_commands::*;
pub use storage::*;
pub use export::*;
pub use presets::*;
pub use downloads::*;
pub use kohya_configs::*;
pub use sd_scripts::*;
pub use gpu::*;
pub use python_utils::*;
pub use library_types::*;
pub use model_types::*;
pub use event_types::*;
pub use engine_report::*;
pub use engine_setup::*;

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use system::write_accelerate_config_file;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RunnerState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_platform,
            get_settings,
            update_settings,
            storage_report,
            system_status,
            write_accelerate_config,
            install_pytorch,
            bootstrap_engine,
            sd_scripts_report,
            install_sd_scripts,
            open_path_in_finder,
            list_projects,
            create_project,
            delete_project,
            rename_project,
            list_folders,
            create_folder,
            update_folder,
            delete_folder,
            list_assets,
            create_asset,
            update_asset,
            get_asset_paths,
            list_asset_models,
            import_lora,
            list_characters,
            create_character,
            get_character_paths,
            import_images,
            import_images_with_mode,
            import_asset_images,
            import_asset_images_with_mode,
            list_dataset_images,
            read_image_categories,
            set_image_category,
            read_caption,
            write_caption,
            list_models,
            list_flux_model_catalog,
            get_flux_model_status,
            download_flux_model_bundle,
            download_flux_shared_dependencies,
            download_sdxl_base_model,
            download_blip_weights,
            cancel_download,
            remove_flux_model_bundle,
            remove_sdxl_base_model,
            remove_blip_weights,
            list_presets,
            engine_preflight,
            setup_status,
            auto_setup_engine,
            dataset_preflight,
            generate_captions,
            generate_captions_blip,
            caption_status,
            run_artifacts_status,
            export_training_package,
            export_model,
            create_run,
            create_character_run,
            create_asset_run,
            prepare_training_package,
            delete_character_image,
            delete_asset_image,
            delete_asset,
            set_run_label,
            delete_run_dir,
            start_training,
            cancel_training,
            is_training_running,
            get_training_log_tail
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_platform() -> String {
    platform_name().to_string()
}

#[tauri::command]
fn open_path_in_finder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let root = library_root(&app)?;
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("Path is required.".to_string());
    }
    let target_can = ensure_within_allowed_open_roots(&root, &target)?;
    if !target_can.exists() {
        return Err("Path not found.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        if target_can.is_file() {
            cmd.arg("-R").arg(&target_can);
        } else {
            cmd.arg(&target_can);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("explorer");
        if target_can.is_file() {
            cmd.arg("/select,").arg(&target_can);
        } else {
            cmd.arg(&target_can);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(&target_can)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

#[tauri::command]
fn set_run_label(app: tauri::AppHandle, run_dir: String, label: String) -> Result<(), String> {
    let root = library_root(&app)?;
    let run_path = PathBuf::from(run_dir.trim());
    let run_can = ensure_within_library_root(&root, &run_path)?;
    if !run_can.is_dir() {
        return Err("Run directory not found.".to_string());
    }
    let version = run_can.file_name().and_then(|v| v.to_str()).unwrap_or("");
    if !is_run_version_dir(version) {
        return Err("Run directory must be a version folder (v###).".to_string());
    }
    let cleaned = label
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    if cleaned.is_empty() {
        return Err("Label is required.".to_string());
    }
    if cleaned.len() > 80 {
        return Err("Label is too long (max 80 characters).".to_string());
    }

    let meta_path = run_can.join("run_meta.json");
    let v = serde_json::json!({
        "schema_version": 1,
        "updated_at": utc_now_iso(),
        "label": cleaned,
    });
    write_json_file(&meta_path, &v)?;
    Ok(())
}

#[tauri::command]
fn delete_run_dir(app: tauri::AppHandle, run_dir: String) -> Result<(), String> {
    let root = library_root(&app)?;
    let run_path = PathBuf::from(run_dir.trim());
    let run_can = ensure_within_library_root(&root, &run_path)?;
    if !run_can.is_dir() {
        return Err("Run directory not found.".to_string());
    }
    let version = run_can.file_name().and_then(|v| v.to_str()).unwrap_or("");
    if !is_run_version_dir(version) {
        return Err("Run directory must be a version folder (v###).".to_string());
    }
    fs::remove_dir_all(&run_can).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn system_status(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let root = library_root(&app)?;
    let cfg_path = system_config_path(&root);

    let cfg = if let Ok(override_root) = std::env::var("FILMCLUSIVE_INSTALL_ROOT") {
        let cfg = config::system_config::SystemConfig::from_install_root(Path::new(&override_root));
        let _ = cfg.save(&cfg_path);
        cfg
    } else {
        load_or_init_system_config(&cfg_path, &root)?
    };

    let rt = system::runtime_for_current_platform();
    let gpu = rt.detect_gpus(&cfg).ok();
    Ok(serde_json::json!({
        "config": cfg,
        "gpu": gpu,
        "checks": {
            "accelerate_config_exists": cfg.accelerate_config_path.is_file(),
        },
    }))
}

#[tauri::command]
fn write_accelerate_config(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let root = library_root(&app)?;
    let cfg_path = system_config_path(&root);

    let cfg = if let Ok(override_root) = std::env::var("FILMCLUSIVE_INSTALL_ROOT") {
        let cfg = config::system_config::SystemConfig::from_install_root(Path::new(&override_root));
        let _ = cfg.save(&cfg_path);
        cfg
    } else {
        load_or_init_system_config(&cfg_path, &root)?
    };

    let settings = load_settings(&root)?;
    let rt = system::runtime_for_current_platform();
    let gpu_count = rt
        .detect_gpus(&cfg)
        .ok()
        .map(|report| report.device_count.max(1))
        .unwrap_or(1);

    write_accelerate_config_file(
        cfg.accelerate_config_path.as_path(),
        gpu_count,
        settings.mixed_precision.as_str(),
    )?;

    Ok(serde_json::json!({
        "ok": true,
        "accelerate_config_path": cfg.accelerate_config_path,
        "gpu_count": gpu_count,
        "mixed_precision": settings.mixed_precision,
    }))
}

#[tauri::command]
fn install_pytorch(app: tauri::AppHandle, args: InstallPytorchArgs) -> Result<serde_json::Value, String> {
    let root = library_root(&app)?;
    let cfg_path = system_config_path(&root);

    let cfg = if let Ok(override_root) = std::env::var("FILMCLUSIVE_INSTALL_ROOT") {
        let cfg = config::system_config::SystemConfig::from_install_root(Path::new(&override_root));
        let _ = cfg.save(&cfg_path);
        cfg
    } else {
        load_or_init_system_config(&cfg_path, &root)?
    };

    let rt = system::runtime_for_current_platform();
    rt.create_venv(&cfg)?;

    if !cfg.venv_python.exists() {
        return Err(format!(
            "Venv python not found after venv creation: {}",
            cfg.venv_python.display()
        ));
    }

    let channel = args.channel.trim().to_lowercase();
    let cuda = args.cuda.trim().to_lowercase();
    let is_nightly = channel == "nightly" || channel == "pre" || channel == "preview";

    let index_url = if cuda == "cpu" {
        if is_nightly {
            "https://download.pytorch.org/whl/nightly/cpu".to_string()
        } else {
            "https://download.pytorch.org/whl/cpu".to_string()
        }
    } else {
        let tag = cuda.strip_prefix("cu").unwrap_or(cuda.as_str());
        if is_nightly {
            format!("https://download.pytorch.org/whl/nightly/cu{tag}")
        } else {
            format!("https://download.pytorch.org/whl/cu{tag}")
        }
    };

    let mut steps: Vec<String> = Vec::new();
    steps.push(format!(
        "Using python: {}",
        cfg.venv_python.to_string_lossy()
    ));
    steps.push(format!("PyTorch channel: {}", if is_nightly { "nightly" } else { "stable" }));
    steps.push(format!("PyTorch index-url: {}", index_url));

    let bootstrap = Command::new(&cfg.venv_python)
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--upgrade")
        .arg("pip")
        .arg("setuptools")
        .arg("wheel")
        .output()
        .map_err(|e| e.to_string())?;
    steps.push(format!(
        "pip bootstrap exit={:?}",
        bootstrap.status.code()
    ));
    if !bootstrap.status.success() {
        return Err(format!(
            "pip bootstrap failed: {}",
            String::from_utf8_lossy(&bootstrap.stderr).trim()
        ));
    }

    let mut install = Command::new(&cfg.venv_python);
    install
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--upgrade");
    if is_nightly {
        install.arg("--pre");
    }
    install
        .arg("--index-url")
        .arg(&index_url)
        .arg("torch")
        .arg("torchvision");

    steps.push(format!("Running: {:?}", install));
    let output = install.output().map_err(|e| e.to_string())?;
    steps.push(format!("pip install exit={:?}", output.status.code()));
    if !output.status.success() {
        return Err(format!(
            "PyTorch install failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let gpu = rt.detect_gpus(&cfg).ok();
    Ok(serde_json::json!({
        "ok": true,
        "steps": steps,
        "index_url": index_url,
        "gpu": gpu,
    }))
}

#[tauri::command]
fn bootstrap_engine(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let root = library_root(&app)?;
    let cfg_path = system_config_path(&root);

    let cfg = if let Ok(override_root) = std::env::var("FILMCLUSIVE_INSTALL_ROOT") {
        let cfg = config::system_config::SystemConfig::from_install_root(Path::new(&override_root));
        let _ = cfg.save(&cfg_path);
        cfg
    } else {
        load_or_init_system_config(&cfg_path, &root)?
    };

    let report = bootstrap::bootstrap_service::BootstrapService::bootstrap(&cfg)?;
    Ok(serde_json::to_value(report).map_err(|e| e.to_string())?)
}

fn load_or_init_system_config(
    cfg_path: &Path,
    install_root: &Path,
) -> Result<config::system_config::SystemConfig, String> {
    if cfg_path.exists() {
        return config::system_config::SystemConfig::load(cfg_path);
    }
    let cfg = config::system_config::SystemConfig::from_install_root(install_root);
    let _ = cfg.save(cfg_path);
    Ok(cfg)
}
