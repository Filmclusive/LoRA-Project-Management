use std::fs;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::engine_management::*;
use crate::lib_refactored::settings::*;
use crate::lib_refactored::python_utils::*;

#[tauri::command]
pub fn list_presets(app: tauri::AppHandle) -> Result<Vec<PresetPublic>, String> {
    let repo_root = find_repo_root(&app)?;
    let presets_dir = repo_root.join("presets");
    let mut out: Vec<PresetPublic> = Vec::new();
    if presets_dir.is_dir() {
        for entry in fs::read_dir(presets_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().map(|s| s == "json").unwrap_or(false) {
                if let Some(preset) = read_json_file(&path).and_then(|v| serde_json::from_value::<PresetFile>(v).ok()) {
                    out.push(PresetPublic {
                        id: preset.id,
                        display_name: preset.display_name,
                        description: preset.description,
                        recommended_images: preset.recommended_images,
                        dataset_policy: preset.dataset_policy,
                        caption_policy: preset.caption_policy,
                        training: preset.training,
                    });
                }
            }
        }
    }
    out.sort_by(|a, b| a.display_name.cmp(&b.display_name));
    Ok(out)
}

#[tauri::command]
pub fn dataset_preflight(
    app: tauri::AppHandle,
    dataset_dir: String,
    preset_id: String,
) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let python_exec = effective_python_executable(&app, &root, &settings);
    run_python_json_with_exec(
        &repo_root,
        python_exec.as_str(),
        &root,
        &settings,
        &[
            "dataset-preflight",
            "--dataset-dir",
            dataset_dir.as_str(),
            "--preset-id",
            preset_id.as_str(),
        ],
    )
}
