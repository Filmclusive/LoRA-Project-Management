use std::path::Path;
use crate::filmclusive_error;
use crate::lib_refactored::types::*;
use crate::lib_refactored::utils::{read_json_file, write_json_file};

pub fn looks_like_flux_checkpoint(path: &str) -> bool {
    let value = path.trim().to_ascii_lowercase();
    if value.is_empty() {
        return false;
    }
    value.contains("\\flux")
        || value.contains("/flux")
        || value.contains("flux1")
        || value.contains("flux.1")
}

pub fn ensure_flux_config_snapshot(run_dir: &Path, settings: &AppSettings) -> Result<(), String> {
    let snapshot_path = run_dir.join("config_snapshot.json");
    let mut snapshot = read_json_file(&snapshot_path).ok_or_else(|| {
        filmclusive_error(
            "CONFIG_SNAPSHOT_MISSING",
            "Run config snapshot not found.",
            &["Build the run again to create a new run folder."],
            Some(snapshot_path.to_string_lossy().to_string()),
        )
    })?;

    let base_model_path = snapshot
        .get("sdxl_base_model_path")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let Some(training) = snapshot
        .get_mut("training")
        .and_then(|value| value.as_object_mut())
    else {
        return Err(filmclusive_error(
            "CONFIG_SNAPSHOT_INVALID",
            "Run config snapshot is missing training settings.",
            &["Build the run again to create a new run folder."],
            Some(snapshot_path.to_string_lossy().to_string()),
        ));
    };

    let arch = training
        .get("model_architecture")
        .and_then(|v| v.as_str())
        .or_else(|| training.get("model_family").and_then(|v| v.as_str()))
        .map(|v| v.trim().to_ascii_lowercase())
        .unwrap_or_else(|| "".to_string());

    let model_path = training
        .get("model_name_or_path")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| base_model_path.clone())
        .unwrap_or_default();
    let inferred_flux = looks_like_flux_checkpoint(&model_path);

    if arch != "flux" && !inferred_flux {
        return Ok(());
    }

    let defaults = settings.training_defaults.as_object();
    let mut updated = false;

    let required = ["model_name_or_path", "flux_clip_l", "flux_t5xxl", "flux_ae"];
    for key in required {
        let has = training
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if has {
            continue;
        }
        let Some(defs) = defaults else { continue };
        let candidate = defs
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        if let Some(value) = candidate {
            training.insert(key.to_string(), serde_json::Value::String(value));
            updated = true;
        }
    }

    if training
        .get("model_architecture")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_ascii_lowercase())
        .as_deref()
        != Some("flux")
    {
        training.insert(
            "model_architecture".to_string(),
            serde_json::Value::String("flux".to_string()),
        );
        updated = true;
    }

    if training
        .get("engine")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .as_deref()
        == Some("adapter:flux")
    {
        training.insert(
            "engine".to_string(),
            serde_json::Value::String("kohya".to_string()),
        );
        updated = true;
    }

    let still_missing: Vec<&str> = required
        .iter()
        .copied()
        .filter(|key| {
            training
                .get(*key)
                .and_then(|v| v.as_str())
                .map(|s| s.trim().is_empty())
                .unwrap_or(true)
        })
        .collect();

    if !still_missing.is_empty() {
        return Err(filmclusive_error(
            "FLUX_COMPONENTS_MISSING",
            "FLUX training requires additional model component paths, but they are not configured.",
            &[
                "Open Settings \u{2192} System and (re)install the managed FLUX Schnell bundle.",
                "Then rebuild the run (or retry training after settings load).",
            ],
            Some(format!(
                "missing={:?}\\ntraining_defaults={}",
                still_missing, settings.training_defaults
            )),
        ));
    }

    if updated {
        write_json_file(&snapshot_path, &snapshot)?;
    }

    Ok(())
}

pub fn inject_flux_defaults(
    training: &mut serde_json::Map<String, serde_json::Value>,
    settings: &AppSettings,
) {
    let Some(defs) = settings.training_defaults.as_object() else {
        return;
    };

    let keys = [
        ("model_architecture", true),
        ("model_name_or_path", false),
        ("flux_clip_l", false),
        ("flux_t5xxl", false),
        ("flux_ae", false),
    ];

    for (key, force) in keys {
        let has = training
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if has && !force {
            continue;
        }
        let candidate = defs
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        if let Some(value) = candidate {
            training.insert(key.to_string(), serde_json::Value::String(value));
        }
    }
}

pub fn ensure_adapter_config_snapshot(run_dir: &Path, _settings: &AppSettings) -> Result<(), String> {
    let snapshot_path = run_dir.join("config_snapshot.json");
    let mut snapshot = read_json_file(&snapshot_path).ok_or_else(|| {
        filmclusive_error(
            "CONFIG_SNAPSHOT_MISSING",
            "Run config snapshot not found.",
            &["Build the run again to create a new run folder."],
            Some(snapshot_path.to_string_lossy().to_string()),
        )
    })?;

    let Some(_training) = snapshot
        .get_mut("training")
        .and_then(|value| value.as_object_mut())
    else {
        return Err(filmclusive_error(
            "CONFIG_SNAPSHOT_INVALID",
            "Run config snapshot is missing training settings.",
            &["Build the run again to create a new run folder."],
            Some(snapshot_path.to_string_lossy().to_string()),
        ));
    };

    let updated = false;
    // ... (rest of the logic)
    if updated {
        write_json_file(&snapshot_path, &snapshot)?;
    }
    Ok(())
}
