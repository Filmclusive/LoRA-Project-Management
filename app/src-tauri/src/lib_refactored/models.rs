use std::path::{Path, PathBuf};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::lib_refactored::types::*;
use crate::lib_refactored::utils::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::assets::ensure_asset_dirs;
use crate::lib_refactored::engine_management::read_run_engine_key;

fn iso_from_epoch_secs(secs: u64) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp(secs as i64, 0)
        .unwrap_or_else(|| chrono::Utc::now())
        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn iso_to_epoch_secs(value: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.timestamp())
}

pub fn flux_schnell_files() -> (FluxCatalogFile, Vec<FluxCatalogFile>) {
    let base = FluxCatalogFile {
        file_name: "flux1-schnell.safetensors".to_string(),
        relative_path: "flux/FLUX.1-schnell/flux1-schnell.safetensors".to_string(),
        sha256: "9403429e0052277ac2a87ad800adece5481eecefd9ed334e1f348723621d2a0a".to_string(),
        size_bytes: 23_782_506_688,
        url: "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/flux1-schnell.safetensors".to_string(),
        license: "Apache-2.0".to_string(),
    };
    let deps = vec![
        FluxCatalogFile {
            file_name: "ae.safetensors".to_string(),
            relative_path: "flux/FLUX.1-schnell/ae.safetensors".to_string(),
            sha256: "afc8e28272cd15db3919bacdb6918ce9c1ed22e96cb12c4d5ed0fba823529e38".to_string(),
            size_bytes: 335_304_388,
            url: "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors".to_string(),
            license: "Apache-2.0".to_string(),
        },
        FluxCatalogFile {
            file_name: "clip_l.safetensors".to_string(),
            relative_path: "flux/shared/clip_l.safetensors".to_string(),
            sha256: "660c6f5b1abae9dc498ac2d21e1347d2abdb0cf6c0c0c8576cd796491d9a6cdd".to_string(),
            size_bytes: 246_144_152,
            url: "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors".to_string(),
            license: "Apache-2.0".to_string(),
        },
        FluxCatalogFile {
            file_name: "t5xxl_fp16.safetensors".to_string(),
            relative_path: "flux/shared/t5xxl_fp16.safetensors".to_string(),
            sha256: "6e480b09fae049a72d2a8c5fbccb8d3e92febeb233bbe9dfe7256958a9167635".to_string(),
            size_bytes: 9_787_841_024,
            url: "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors".to_string(),
            license: "Apache-2.0".to_string(),
        },
    ];
    (base, deps)
}

pub fn flux_catalog(root: &Path, settings: &AppSettings) -> Vec<FluxCatalogEntry> {
    let (base_model, dependencies) = flux_schnell_files();
    let install_root = effective_model_download_root(root, settings);
    vec![FluxCatalogEntry {
        id: "flux1-schnell".to_string(),
        display_name: "FLUX.1 Schnell".to_string(),
        description: "Commercial-safe FLUX base model managed by Filmclusive.".to_string(),
        license: "Apache-2.0".to_string(),
        source_repo: "black-forest-labs/FLUX.1-schnell".to_string(),
        source_url: "https://huggingface.co/black-forest-labs/FLUX.1-schnell".to_string(),
        install_root: install_root.to_string_lossy().to_string(),
        base_model,
        dependencies,
    }]
}

pub fn primary_safetensors_path(run_dir: &Path) -> Option<String> {
    let mut candidates: Vec<(SystemTime, String)> = Vec::new();
    let rd = fs::read_dir(run_dir).ok()?;
    for entry in rd.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(ext) = path.extension().and_then(|s| s.to_str()) else {
            continue;
        };
        if !ext.eq_ignore_ascii_case("safetensors") {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(UNIX_EPOCH);
        candidates.push((modified, path.to_string_lossy().to_string()));
    }
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.first().map(|(_, p)| p.clone())
}

pub fn artifacts_for_path(
    path: &Path,
    metadata_path: Option<&Path>,
    source_path: Option<String>,
) -> AssetModelArtifact {
    let meta = fs::metadata(path).ok();
    AssetModelArtifact {
        path: path.to_string_lossy().to_string(),
        sha256: if path.is_file() {
            sha256_file_hex(path).ok()
        } else {
            None
        },
        size_bytes: meta.map(|value| value.len()).unwrap_or(0),
        metadata_path: metadata_path.map(|value| value.to_string_lossy().to_string()),
        source_path,
    }
}

pub fn list_asset_model_summaries(
    root: &Path,
    project: &Project,
    asset: &Asset,
) -> Result<Vec<AssetModelSummary>, String> {
    let paths = ensure_asset_dirs(root, project, asset.id)?;
    let mut out: Vec<AssetModelSummary> = Vec::new();

    // Imported models: metadata is written alongside the imported `.safetensors` in `imports_dir`.
    let imports_dir = PathBuf::from(&paths.imports_dir);
    if imports_dir.is_dir() {
        if let Ok(rd) = fs::read_dir(&imports_dir) {
            for entry in rd.flatten() {
                let meta_path = entry.path();
                if !meta_path.is_file() {
                    continue;
                }
                if meta_path
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|ext| !ext.eq_ignore_ascii_case("json"))
                    .unwrap_or(true)
                {
                    continue;
                }

                let Some(meta) = read_json_file(&meta_path) else {
                    continue;
                };

                let model_path = meta
                    .get("model_path")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                let Some(model_path) = model_path else {
                    continue;
                };
                let model_path_buf = PathBuf::from(&model_path);
                if !model_path_buf.is_file() {
                    continue;
                }

                let id = meta
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("import")
                    .to_string();
                let name = meta
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or_else(|| {
                        model_path_buf
                            .file_name()
                            .and_then(|v| v.to_str())
                            .unwrap_or("imported_model")
                    })
                    .to_string();
                let version = meta
                    .get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or("imported")
                    .to_string();
                let trained_at = meta
                    .get("trained_at")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let status = meta
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Imported")
                    .to_string();
                let engine_key = meta
                    .get("engine_key")
                    .and_then(|v| v.as_str())
                    .unwrap_or("import")
                    .to_string();
                let model_family = meta
                    .get("model_family")
                    .and_then(|v| v.as_str())
                    .unwrap_or(asset.model_family.as_str())
                    .to_string();
                let trigger_tokens = meta
                    .get("trigger_tokens")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|x| x.as_str().map(|s| s.to_string()))
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_else(|| asset.trigger_tokens.clone());
                let source_path = meta
                    .get("source_path")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                let artifacts = vec![artifacts_for_path(
                    &model_path_buf,
                    Some(&meta_path),
                    source_path.clone(),
                )];

                out.push(AssetModelSummary {
                    id,
                    asset_id: asset.id,
                    name,
                    version,
                    trained_at,
                    status,
                    run_dir: None,
                    engine_key,
                    imported: true,
                    model_family,
                    trigger_tokens,
                    artifacts,
                });
            }
        }
    }

    // Trained runs: one folder per run under `runs_root` (usually `v0001`, `v0002`, ...).
    let runs_root = PathBuf::from(&paths.runs_root);
    if runs_root.is_dir() {
        if let Ok(rd) = fs::read_dir(&runs_root) {
            for entry in rd.flatten() {
                let dir = entry.path();
                if !dir.is_dir() {
                    continue;
                }
                let version = dir
                    .file_name()
                    .and_then(|v| v.to_str())
                    .unwrap_or("")
                    .to_string();

                let mut safetensors: Vec<PathBuf> = Vec::new();
                if let Ok(files) = fs::read_dir(&dir) {
                    for e in files.flatten() {
                        let p = e.path();
                        if p.is_file()
                            && p.extension()
                                .and_then(|s| s.to_str())
                                .map(|ext| ext.eq_ignore_ascii_case("safetensors"))
                                .unwrap_or(false)
                        {
                            safetensors.push(p);
                        }
                    }
                }
                safetensors.sort();

                let primary = primary_safetensors_path(&dir).and_then(|p| {
                    let pb = PathBuf::from(p);
                    if pb.is_file() { Some(pb) } else { None }
                });

                // Only treat this as a run entry if it has at least some run shape.
                if safetensors.is_empty()
                    && !dir.join("config_snapshot.json").is_file()
                    && !dir.join("training_log.txt").is_file()
                {
                    continue;
                }

                let (status, trained_at) = if let Some(primary_path) = primary.as_ref() {
                    let trained_at = file_modified_epoch_secs(primary_path)
                        .ok()
                        .map(iso_from_epoch_secs);
                    ("Trained".to_string(), trained_at)
                } else if dir.join("training_log.txt").is_file() {
                    ("Running".to_string(), None)
                } else {
                    ("Created".to_string(), None)
                };

                let mut artifacts: Vec<AssetModelArtifact> = Vec::new();
                if let Some(primary_path) = primary.as_ref() {
                    artifacts.push(artifacts_for_path(primary_path, None, None));
                }
                for p in safetensors {
                    if primary.as_ref().is_some_and(|primary_path| primary_path == &p) {
                        continue;
                    }
                    artifacts.push(artifacts_for_path(&p, None, None));
                }

                let engine_key = read_run_engine_key(&dir).unwrap_or_else(|| "kohya".to_string());
                let run_dir = dir.to_string_lossy().to_string();
                out.push(AssetModelSummary {
                    id: format!("run:{}:{}", asset.id, version),
                    asset_id: asset.id,
                    name: asset.name.clone(),
                    version,
                    trained_at,
                    status,
                    run_dir: Some(run_dir),
                    engine_key,
                    imported: false,
                    model_family: asset.model_family.clone(),
                    trigger_tokens: asset.trigger_tokens.clone(),
                    artifacts,
                });
            }
        }
    }

    // Newest first.
    out.sort_by(|a, b| {
        let at = a
            .trained_at
            .as_deref()
            .and_then(iso_to_epoch_secs)
            .unwrap_or(i64::MIN);
        let bt = b
            .trained_at
            .as_deref()
            .and_then(iso_to_epoch_secs)
            .unwrap_or(i64::MIN);
        bt.cmp(&at).then_with(|| b.version.cmp(&a.version))
    });

    Ok(out)
}

pub fn build_asset_summary(root: &Path, project: &Project, asset: &Asset) -> AssetSummary {
    let models = list_asset_model_summaries(root, project, asset).unwrap_or_default();
    let last_trained_at = models
        .iter()
        .filter_map(|model| model.trained_at.clone())
        .max();
    let status = if models.iter().any(|model| model.status == "Trained") {
        "Trained".to_string()
    } else if models.iter().any(|model| model.imported) {
        "Imported".to_string()
    } else if asset.dataset_image_count > 0 {
        "Ready".to_string()
    } else {
        "New".to_string()
    };

    AssetSummary {
        id: asset.id,
        name: asset.name.clone(),
        asset_type: asset.asset_type.clone(),
        folder_id: asset.folder_id,
        model_family: asset.model_family.clone(),
        created_at: asset.created_at.clone(),
        updated_at: asset.updated_at.clone(),
        dataset_image_count: asset.dataset_image_count,
        tags: asset.tags.clone(),
        trigger_tokens: asset.trigger_tokens.clone(),
        notes: asset.notes.clone(),
        status,
        version_count: models.len() as u32,
        last_trained_at,
        source_character_id: asset.source_character_id,
        training_steps_override: asset.training_steps_override,
    }
}

pub fn load_flux_install_manifest(root: &Path, settings: &AppSettings) -> Option<FluxInstallManifest> {
    let path = managed_manifest_path(root, settings);
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn write_flux_install_manifest(
    root: &Path,
    settings: &AppSettings,
    files: &[ManagedFileManifest],
) -> Result<(), String> {
    let path = managed_manifest_path(root, settings);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let manifest = FluxInstallManifest {
        schema_version: 1,
        generated_at: utc_now_iso(),
        files: files.to_vec(),
    };
    fs::write(
        path,
        serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

pub fn verify_managed_file(
    path: &Path,
    expected_sha: &str,
    expected_size: u64,
    manifest_entry: Option<&ManagedFileManifest>,
) -> Result<(), String> {
    if !path.is_file() {
        return Err(format!("Missing file: {}", path.display()));
    }
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() != expected_size {
        return Err(format!("Unexpected size for {}", path.display()));
    }
    let modified = file_modified_epoch_secs(path)?;
    if let Some(entry) = manifest_entry {
        if entry.sha256 == expected_sha
            && entry.size_bytes == expected_size
            && entry.modified_at_epoch_secs == modified
        {
            return Ok(());
        }
    }
    let actual = sha256_file_hex(path)?;
    if actual != expected_sha {
        return Err(format!("Checksum mismatch for {}", path.display()));
    }
    Ok(())
}

pub fn flux_schnell_status(root: &Path, settings: &AppSettings) -> FluxModelInstallStatus {
    let catalog = flux_catalog(root, settings);
    let entry = catalog.first().expect("flux catalog missing");
    let base_path = flux_file_destination(root, settings, &entry.base_model);
    let ae_path = flux_file_destination(root, settings, &entry.dependencies[0]);
    let clip_path = flux_file_destination(root, settings, &entry.dependencies[1]);
    let t5_path = flux_file_destination(root, settings, &entry.dependencies[2]);
    let mut problems = Vec::new();
    let manifest = load_flux_install_manifest(root, settings);

    for (path, file) in [
        (&base_path, &entry.base_model),
        (&ae_path, &entry.dependencies[0]),
        (&clip_path, &entry.dependencies[1]),
        (&t5_path, &entry.dependencies[2]),
    ] {
        let manifest_entry = manifest.as_ref().and_then(|m| {
            m.files
                .iter()
                .find(|x| x.relative_path == file.relative_path)
        });
        if let Err(err) = verify_managed_file(path, &file.sha256, file.size_bytes, manifest_entry) {
            problems.push(err);
        }
    }

    let ready = problems.is_empty();
    let installed = [&base_path, &ae_path, &clip_path, &t5_path]
        .iter()
        .all(|p| p.exists());
    let model_root = effective_model_download_root(root, settings)
        .join("flux")
        .join("FLUX.1-schnell");
    FluxModelInstallStatus {
        id: entry.id.clone(),
        display_name: entry.display_name.clone(),
        license: entry.license.clone(),
        installed,
        ready,
        needs_repair: installed && !ready,
        model_root: model_root.to_string_lossy().to_string(),
        base_model_path: base_path.to_string_lossy().to_string(),
        ae_path: ae_path.to_string_lossy().to_string(),
        clip_l_path: clip_path.to_string_lossy().to_string(),
        t5xxl_path: t5_path.to_string_lossy().to_string(),
        problems,
    }
}

pub fn sync_managed_flux_settings(root: &Path, settings: &mut AppSettings) {
    if settings.model_download_root.trim().is_empty() {
        settings.model_download_root = default_model_download_root(root)
            .to_string_lossy()
            .to_string();
    }
    if settings.flux_model_catalog_version == 0 {
        settings.flux_model_catalog_version = 1;
    }
    if settings.preferred_flux_model_id.trim().is_empty() {
        return;
    }
    if settings.preferred_flux_model_id != "flux1-schnell" {
        settings.preferred_flux_model_id.clear();
        return;
    }
    let status = flux_schnell_status(root, settings);
    if !status.ready {
        return;
    }

    let current = settings.training_defaults.clone();
    let merged = merged_json(&crate::lib_refactored::models::default_flux_training_defaults(), &current);
    let wired = merged_json(
        &merged,
        &serde_json::json!({
            "model_architecture": "flux",
            "model_name_or_path": status.base_model_path,
            "flux_clip_l": status.clip_l_path,
            "flux_t5xxl": status.t5xxl_path,
            "flux_ae": status.ae_path,
            "flux_guidance_scale": 1.0,
            "flux_timestep_sampling": "flux_shift",
            "flux_model_prediction_type": "raw",
            "gradient_checkpointing": true,
            "cache_latents": true,
            "cache_text_encoder_outputs": true,
        }),
    );
    settings.training_defaults = wired;
}

pub fn default_flux_training_defaults() -> serde_json::Value {
    serde_json::json!({
        "model_architecture": "flux",
        "target_type": "lora",
        "rank": 32,
        "alpha": 32,
        "mixed_precision": "fp16",
        "gradient_checkpointing": true,
        "cache_latents": true,
        "cache_text_encoder_outputs": true,
        "flux_guidance_scale": 1.0,
        "flux_timestep_sampling": "flux_shift",
        "flux_model_prediction_type": "raw",
        "flux_model_type": "flux",
    })
}
