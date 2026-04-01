use std::path::PathBuf;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::engine_management::*;
use crate::lib_refactored::settings::*;
use crate::lib_refactored::models::*;
use crate::lib_refactored::gpu::*;
use crate::lib_refactored::python_utils::*;

#[tauri::command]
pub fn engine_preflight(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let repo_root = find_repo_root(&app)?;
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;
    let gpu = linux_gpu_preflight(12);
    let cuda_variant_selected = if cfg!(target_os = "linux") {
        select_linux_cuda_variant(&settings, &gpu)
    } else {
        "".to_string()
    };

    let python_exec = effective_python_executable(&app, &root, &settings);
    let kohya_dir = repo_root.join("vendor").join("kohya");
    let mut py_report = match run_python_json_with_exec(
        &repo_root,
        python_exec.as_str(),
        &root,
        &settings,
        &["engine-preflight"],
    ) {
        Ok(v) => v,
        Err(e) => {
            let mut messages: Vec<String> = Vec::new();
            messages.push(format!("Engine check could not run. {e}"));
            serde_json::json!({
                "ok": false,
                "python": { "executable": python_exec, "version": "unknown" },
                "modules": {},
                "torch": { "available": false, "version": null },
                "kohya": {
                    "dir": kohya_dir.to_string_lossy().to_string(),
                    "present": kohya_dir.is_dir(),
                    "requirements_txt": kohya_dir.join("requirements.txt").is_file(),
                    "sdxl_train_network_py": kohya_dir.join("sdxl_train_network.py").is_file(),
                    "flux_train_network_py": kohya_dir.join("flux_train_network.py").is_file(),
                },
                "messages": messages,
            })
        }
    };

    let mut messages: Vec<String> = Vec::new();
    if let Some(arr) = py_report.get("messages").and_then(|v| v.as_array()) {
        for m in arr {
            if let Some(s) = m.as_str() {
                messages.push(s.to_string());
            }
        }
    }
    if let GpuPreflight::LinuxNvidia {
        messages: gpu_msgs, ..
    } = &gpu
    {
        for m in gpu_msgs {
            messages.push(m.clone());
        }
    }

    let caption_backend = settings.caption_backend.trim().to_ascii_lowercase();
    let needs_blip = caption_backend == "blip";

    if needs_blip && settings.blip_caption_weights_path.trim().is_empty() {
        messages.push("BLIP caption weights are not set. Descriptions can’t be generated until you install weights or choose a local file in Settings.".to_string());
    }

    let engine_files_ok = kohya_dir.is_dir()
        && kohya_dir.join("requirements.txt").is_file()
        && kohya_dir.join("flux_train_network.py").is_file();
    if !engine_files_ok {
        messages.push(
            "Training engine files are missing. Reinstall the app or restore the bundled engine."
                .to_string(),
        );
    }

    let py_ok = py_report
        .get("ok")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let gpu_ok = match &gpu {
        GpuPreflight::LinuxNvidia { ok, .. } => *ok,
        _ => true,
    };
    let final_ok = if cfg!(target_os = "linux") {
        py_ok && gpu_ok && engine_files_ok
    } else {
        py_ok && engine_files_ok
    };

    if let Some(obj) = py_report.as_object_mut() {
        obj.insert("ok".to_string(), serde_json::Value::Bool(final_ok));
        obj.insert(
            "platform".to_string(),
            serde_json::Value::String(platform_name().to_string()),
        );
        obj.insert(
            "gpu".to_string(),
            serde_json::to_value(gpu).unwrap_or(serde_json::Value::Null),
        );
        if cfg!(target_os = "linux") {
            obj.insert(
                "linux_cuda_variant_selected".to_string(),
                serde_json::Value::String(cuda_variant_selected),
            );
        }
        obj.insert(
            "python_executable_selected".to_string(),
            serde_json::Value::String(python_exec),
        );
        if let Some(kohya_obj) = obj.get_mut("kohya").and_then(|v| v.as_object_mut()) {
            kohya_obj.insert(
                "flux_train_network_py".to_string(),
                serde_json::Value::Bool(kohya_dir.join("flux_train_network.py").is_file()),
            );
        }
        obj.insert(
            "messages".to_string(),
            serde_json::Value::Array(
                messages
                    .into_iter()
                    .map(serde_json::Value::String)
                    .collect(),
            ),
        );
    }
    Ok(py_report)
}

#[tauri::command]
pub fn setup_status(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let root = library_root(&app)?;
    let settings = load_settings(&root)?;

    let python_exec = effective_python_executable(&app, &root, &settings);
    let sdxl_path = settings.sdxl_base_model_path.trim();
    let blip_path = settings.blip_caption_weights_path.trim();
    let caption_backend = settings.caption_backend.trim().to_ascii_lowercase();
    let needs_blip = caption_backend == "blip";
    let flux_status = flux_schnell_status(&root, &settings);

    let engine_report = engine_preflight(app.clone())?;
    let engine_ok = engine_report
        .get("ok")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let sdxl_ok = if sdxl_path.is_empty() {
        false
    } else {
        let p = PathBuf::from(sdxl_path);
        p.is_file() || p.is_dir()
    };

    let blip_ok = if blip_path.is_empty() {
        false
    } else {
        PathBuf::from(blip_path).is_file()
    };

    let flux_ok = flux_status.ready && settings.preferred_flux_model_id == "flux1-schnell";

    let mut missing: Vec<String> = Vec::new();
    if python_exec.trim().is_empty() {
        missing.push("Python executable is not set.".to_string());
    }
    if sdxl_path.is_empty() {
        missing.push("Base model is not set.".to_string());
    } else if !sdxl_ok {
        missing.push("Base model path is invalid.".to_string());
    }
    if !flux_ok {
        missing.push("Open Settings \u{2192} System and install or repair FLUX Schnell.".to_string());
    }
    if needs_blip {
        if blip_path.is_empty() {
            missing.push("BLIP weights are not set.".to_string());
        } else if !blip_ok {
            missing.push("BLIP weights path is invalid.".to_string());
        }
    }
    if !engine_ok {
        if let Some(msgs) = engine_report.get("messages").and_then(|v| v.as_array()) {
            for m in msgs.iter().filter_map(|v| v.as_str()).take(3) {
                missing.push(m.to_string());
            }
        }
    }

    let ok = engine_ok && sdxl_ok && flux_ok && (!needs_blip || blip_ok);
    let details = if ok {
        None
    } else {
        let mut parts: Vec<String> = Vec::new();
        if python_exec.trim().is_empty() {
            parts.push("python_executable=unset".to_string());
        } else {
            parts.push(format!("python_executable={}", python_exec));
        }
        if !sdxl_ok && !sdxl_path.is_empty() {
            parts.push(format!("sdxl_base_model_path={}", sdxl_path));
        }
        if needs_blip && !blip_ok && !blip_path.is_empty() {
            parts.push(format!("blip_caption_weights_path={}", blip_path));
        }
        if !flux_ok {
            parts.push(format!(
                "flux_ready={} preferred_flux_model_id={}",
                flux_status.ready, settings.preferred_flux_model_id
            ));
        }
        if parts.is_empty() {
            None
        } else {
            Some(parts.join("\n"))
        }
    };

    Ok(serde_json::json!({
        "ok": ok,
        "engine_ok": engine_ok,
        "sdxl_base_model_ok": sdxl_ok,
        "flux_ok": flux_ok,
        "blip_weights_ok": blip_ok,
        "missing": missing,
        "details": details,
        "engine_report": engine_report,
    }))
}
