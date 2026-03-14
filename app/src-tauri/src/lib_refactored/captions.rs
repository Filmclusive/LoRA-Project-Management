use std::path::{Path, PathBuf};
use std::fs;
use std::process::{Command, Stdio};
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::settings::*;
use crate::lib_refactored::engine_management::*;
use crate::lib_refactored::python_utils::*;

pub fn find_caption_sidecar_for_image(image_path: &Path) -> Option<PathBuf> {
    let sidecar = image_path.with_extension("txt");
    if sidecar.exists() {
        return Some(sidecar);
    }
    None
}

pub fn try_import_caption_sidecar(sidecar_path: &Path, dest_path: &Path) -> Result<(), String> {
    if !sidecar_path.is_file() {
        return Ok(());
    }
    fs::copy(sidecar_path, dest_path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn is_supported_image_ext(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg" | "webp")
}

pub fn validate_dataset_file_name(file_name: &str) -> Result<(), String> {
    let p = Path::new(file_name);
    if p.file_name().and_then(|s| s.to_str()) != Some(file_name) {
        return Err("Invalid file name.".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn generate_captions(
    app: tauri::AppHandle,
    dataset_dir: String,
    preset_id: String,
) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let python_exec = effective_python_executable(&app, &root, &settings);
    let backend = settings.caption_backend.trim().to_ascii_lowercase();
    if backend == "vision" {
        let provider = settings.vision_caption_provider.trim().to_ascii_lowercase();
        let (base_url, model) = if provider == "openai" {
            (
                settings.openai_compat_base_url.trim(),
                settings.openai_compat_vision_model.trim(),
            )
        } else {
            (
                settings.ollama_base_url.trim(),
                settings.ollama_vision_model.trim(),
            )
        };
        if base_url.is_empty() || model.is_empty() {
            return Err(filmclusive_error(
                "VISION_CAPTION_SETTINGS_MISSING",
                "Vision caption settings are not configured.",
                &[
                    "Open Settings > System and choose a vision caption provider and model.",
                    "Ensure Ollama or LM Studio is running locally, then retry.",
                ],
                Some(format!(
                    "provider={provider}\nbase_url={base_url}\nmodel={model}"
                )),
            ));
        }
        run_python_json_with_exec(
            &repo_root,
            python_exec.as_str(),
            &root,
            &settings,
            &[
                "caption-vision",
                "--dataset-dir",
                dataset_dir.as_str(),
                "--preset-id",
                preset_id.as_str(),
                "--provider",
                provider.as_str(),
                "--base-url",
                base_url,
                "--model",
                model,
            ],
        )
    } else if backend == "blip" {
        run_blip_captioning(
            &repo_root,
            &root,
            &settings,
            python_exec.as_str(),
            dataset_dir.as_str(),
            settings.blip_caption_weights_path.as_str(),
            ".txt",
        )
    } else {
        run_python_json_with_exec(
            &repo_root,
            python_exec.as_str(),
            &root,
            &settings,
            &[
                "caption",
                "--dataset-dir",
                dataset_dir.as_str(),
                "--preset-id",
                preset_id.as_str(),
            ],
        )
    }
}

pub fn count_images_and_captions(dir: &Path, caption_ext: &str) -> Result<(u32, u32), String> {
    if !dir.is_dir() {
        return Err("Dataset directory not found.".to_string());
    }
    let mut image_count = 0u32;
    let mut caption_count = 0u32;
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
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
        image_count += 1;
        let caption_path = if caption_ext.starts_with('.') {
            path.with_extension(&caption_ext[1..])
        } else {
            path.with_extension(caption_ext)
        };
        if caption_path.exists() {
            caption_count += 1;
        }
    }
    Ok((image_count, caption_count))
}

pub fn run_blip_captioning(
    repo_root: &Path,
    root: &Path,
    settings: &AppSettings,
    python_exec: &str,
    dataset_dir: &str,
    caption_weights_path: &str,
    caption_extension: &str,
) -> Result<serde_json::Value, String> {
    let exec = python_exec.trim();
    if exec.is_empty() {
        return Err(filmclusive_error(
            "PYTHON_EXECUTABLE_MISSING",
            "Python executable is not configured.",
            &[
                "Run Auto setup in Settings > System.",
                "Or set the Python executable manually in Settings > System.",
            ],
            Some(format!(
                "settings.python_executable={}",
                settings.python_executable
            )),
        ));
    }

    let dir = PathBuf::from(dataset_dir);
    if !dir.is_dir() {
        return Err(filmclusive_error(
            "DATASET_DIR_MISSING",
            "Dataset directory not found.",
            &[
                "Add photos first.",
                "If the folder was moved, re-import your photos.",
            ],
            Some(dataset_dir.to_string()),
        ));
    }

    let weights = caption_weights_path.trim();
    if weights.is_empty() {
        return Err(filmclusive_error(
            "BLIP_WEIGHTS_MISSING",
            "Description model weights are not set.",
            &[
                "Open Settings and click Install for BLIP weights.",
                "Or choose a local BLIP weights file (model_large_caption.pth).",
            ],
            None,
        ));
    }
    if weights.starts_with("http://") || weights.starts_with("https://") {
        return Err(filmclusive_error(
            "BLIP_WEIGHTS_INVALID",
            "BLIP weights must be a local file path.",
            &["Open Settings and click Install for BLIP weights, or choose a local file."],
            Some(weights.to_string()),
        ));
    }
    let weights_path = PathBuf::from(weights);
    if !weights_path.is_file() {
        return Err(filmclusive_error(
            "BLIP_WEIGHTS_INVALID",
            "Description model weights file not found.",
            &["Open Settings and choose a valid local file."],
            Some(weights.to_string()),
        ));
    }

    let kohya_dir = repo_root.join("vendor").join("kohya");
    let script = kohya_dir.join("finetune").join("make_captions.py");
    if !script.is_file() {
        return Err(filmclusive_error(
            "KOHYA_ENTRYPOINT_MISSING",
            "BLIP caption script was not found. The kohya submodule may not be initialized.",
            &[
                "Initialize git submodules for kohya sd-scripts.",
                "Run engine auto setup again.",
            ],
            Some(script.display().to_string()),
        ));
    }

    let ext = if caption_extension.trim().is_empty() {
        ".txt".to_string()
    } else {
        caption_extension.trim().to_string()
    };

    let run_once = |force_cpu: bool| -> Result<std::process::Output, String> {
        let mut command = Command::new(exec);
        command
            .arg(&script)
            .arg(dir.to_string_lossy().to_string())
            .arg("--caption_weights")
            .arg(weights_path.to_string_lossy().to_string())
            .arg("--caption_extension")
            .arg(ext.clone())
            .arg("--batch_size")
            .arg("1")
            .env("FILMCLUSIVE_REPO_ROOT", repo_root);
        if force_cpu {
            command.env("FILMCLUSIVE_FORCE_CPU", "1");
        }
        command
            .current_dir(&kohya_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        apply_model_download_env(&mut command, root, settings)?;
        command.output().map_err(|e| e.to_string())
    };

    let mut output = run_once(false)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let lowered = stderr.to_ascii_lowercase();
        if lowered.contains("no kernel image is available for execution on the device")
            || lowered.contains("cuda error: no kernel image is available")
        {
            output = run_once(true)?;
        }
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let lowered = stderr.to_ascii_lowercase();
        if lowered.contains("no kernel image is available for execution on the device")
            || lowered.contains("cuda error: no kernel image is available")
        {
            return Err(filmclusive_error(
                "CUDA_INCOMPATIBLE",
                "BLIP tried to run on CUDA, but your torch/CUDA build is not compatible with your GPU.",
                &[
                    "Update/reinstall the training engine (Auto setup) so torch matches your GPU, or use CPU captioning.",
                    "If this is a very old NVIDIA GPU, you may need to use an older CUDA / torch wheel.",
                ],
                Some(format!(
                    "python_executable={}\nexit={:?}\nstdout={}\nstderr={}",
                    exec,
                    output.status.code(),
                    stdout.trim(),
                    stderr.trim()
                )),
            ));
        }
        if lowered.contains("timm")
            && lowered.contains("dataclass")
            && lowered.contains("mutable default")
        {
            return Err(filmclusive_error(
                "BLIP_DEP_INCOMPATIBLE",
                "BLIP dependencies are incompatible with your Python environment.",
                &[
                    "Open Settings > System and run Auto setup to reinstall kohya requirements.",
                    "If you’re using Python 3.12, BLIP requires a newer timm; rerun Auto setup after updating the app.",
                ],
                Some(format!(
                    "python_executable={}\nexit={:?}\nstdout={}\nstderr={}",
                    exec,
                    output.status.code(),
                    stdout.trim(),
                    stderr.trim()
                )),
            ));
        }
        return Err(filmclusive_error(
            "RUNNER_FAILED",
            "BLIP captioning failed.",
            &[
                "Open Settings > System and run Auto setup to install/update kohya requirements.",
                "Confirm the weights file is compatible and readable.",
            ],
            Some(format!(
                "python_executable={}\nexit={:?}\nstdout={}\nstderr={}",
                exec,
                output.status.code(),
                stdout.trim(),
                stderr.trim()
            )),
        ));
    }

    let (image_count, caption_count) = count_images_and_captions(&dir, &ext)?;
    let missing_count = image_count.saturating_sub(caption_count);

    Ok(serde_json::json!({
        "ok": true,
        "image_count": image_count,
        "caption_count": caption_count,
        "missing_count": missing_count,
        "messages": if missing_count == 0 {
            vec!["Descriptions generated.".to_string()]
        } else {
            vec![format!("Descriptions generated, but {missing_count} images are still missing captions.")]
        }
    }))
}

#[tauri::command]
pub fn generate_captions_blip(
    app: tauri::AppHandle,
    dataset_dir: String,
    caption_weights_path: String,
    caption_extension: Option<String>,
) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let python_exec = effective_python_executable(&app, &root, &settings);

    let ext = caption_extension.unwrap_or_else(|| ".txt".to_string());
    run_blip_captioning(
        &repo_root,
        &root,
        &settings,
        python_exec.as_str(),
        dataset_dir.as_str(),
        caption_weights_path.as_str(),
        ext.as_str(),
    )
}

#[tauri::command]
pub fn caption_status(dataset_dir: String) -> Result<serde_json::Value, String> {
    let dir = PathBuf::from(dataset_dir);
    if !dir.is_dir() {
        return Err("Dataset directory not found.".to_string());
    }

    let mut image_count = 0u32;
    let mut caption_count = 0u32;
    let mut missing: Vec<String> = Vec::new();

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
        image_count += 1;
        let txt = path.with_extension("txt");
        if txt.exists() {
            caption_count += 1;
        } else if missing.len() < 25 {
            missing.push(
                path.file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("image")
                    .to_string(),
            );
        }
    }

    let missing_count = image_count.saturating_sub(caption_count);
    let ok = image_count > 0 && missing_count == 0;

    Ok(serde_json::json!({
        "ok": ok,
        "image_count": image_count,
        "caption_count": caption_count,
        "missing_count": missing_count,
        "missing": missing,
        "messages": if ok {
            vec!["Captions are ready.".to_string()]
        } else if image_count == 0 {
            vec!["No images found yet.".to_string()]
        } else {
            vec![format!("Missing captions for {missing_count} images. Click “Generate captions”.")]
        }
    }))
}

#[tauri::command]
pub fn read_caption(dataset_dir: String, file_name: String) -> Result<String, String> {
    validate_dataset_file_name(file_name.as_str())?;
    let dir = PathBuf::from(dataset_dir);
    if !dir.is_dir() {
        return Err("Dataset directory not found.".to_string());
    }

    let img = dir.join(&file_name);
    if !img.is_file() {
        return Err("Image not found.".to_string());
    }
    let ext = img
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !is_supported_image_ext(ext.as_str()) {
        return Err("Unsupported image type.".to_string());
    }

    let txt = img.with_extension("txt");
    if !txt.exists() {
        return Ok("".to_string());
    }
    fs::read_to_string(txt).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_caption(dataset_dir: String, file_name: String, caption: String) -> Result<bool, String> {
    validate_dataset_file_name(file_name.as_str())?;
    let dir = PathBuf::from(dataset_dir);
    if !dir.is_dir() {
        return Err("Dataset directory not found.".to_string());
    }

    let img = dir.join(&file_name);
    if !img.is_file() {
        return Err("Image not found.".to_string());
    }
    let ext = img
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !is_supported_image_ext(ext.as_str()) {
        return Err("Unsupported image type.".to_string());
    }

    let txt = img.with_extension("txt");
    let trimmed = caption.trim();
    if trimmed.is_empty() {
        if txt.exists() {
            let _ = fs::remove_file(&txt);
        }
        return Ok(false);
    }

    fs::write(&txt, format!("{trimmed}\n")).map_err(|e| e.to_string())?;
    Ok(true)
}
