use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetPaths {
    pub asset_root: String,
    pub dataset_dir: String,
    pub originals_dir: String,
    pub images_dir: String,
    pub thumbs_dir: String,
    pub runs_root: String,
    pub imports_dir: String,
    pub uses_character_storage: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharacterPaths {
    pub dataset_dir: String,
    pub originals_dir: String,
    pub images_dir: String,
    pub thumbs_dir: String,
    pub runs_root: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportFailure {
    pub source_path: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub imported: u32,
    pub skipped_duplicates: u32,
    pub converted: u32,
    pub failed: u32,
    pub linked: u32,
    pub failures: Vec<ImportFailure>,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportTrainingPackageResult {
    pub destination_root: String,
    pub export_dir: String,
    pub copied_files: Vec<String>,
    pub model_path: String,
    pub manifest_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetModelArtifact {
    pub path: String,
    pub sha256: Option<String>,
    pub size_bytes: u64,
    pub metadata_path: Option<String>,
    pub source_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetModelSummary {
    pub id: String,
    pub asset_id: Uuid,
    pub name: String,
    pub version: String,
    pub trained_at: Option<String>,
    pub status: String,
    pub run_dir: Option<String>,
    pub engine_key: String,
    pub imported: bool,
    pub model_family: String,
    pub trigger_tokens: Vec<String>,
    pub artifacts: Vec<AssetModelArtifact>,
}

#[derive(Debug, Serialize)]
pub struct ModelSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub trained_at: Option<String>,
    pub status: String,
    pub project_id: Uuid,
    pub character_id: Uuid,
    pub character_name: String,
    pub run_dir: String,
    pub preset_id: Option<String>,
    pub primary_safetensors_path: Option<String>,
    pub artifact_paths: ArtifactPaths,
    pub export_ready: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct ArtifactPaths {
    pub config_snapshot_path: String,
    pub dataset_manifest_path: String,
    pub dataset_config_path: String,
    pub kohya_config_path: String,
    pub training_log_path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct FluxCatalogFile {
    pub file_name: String,
    pub relative_path: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub url: String,
    pub license: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct FluxCatalogEntry {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub license: String,
    pub source_repo: String,
    pub source_url: String,
    pub install_root: String,
    pub base_model: FluxCatalogFile,
    pub dependencies: Vec<FluxCatalogFile>,
}

#[derive(Debug, Serialize, Clone)]
pub struct FluxModelInstallStatus {
    pub id: String,
    pub display_name: String,
    pub license: String,
    pub installed: bool,
    pub ready: bool,
    pub needs_repair: bool,
    pub model_root: String,
    pub base_model_path: String,
    pub ae_path: String,
    pub clip_l_path: String,
    pub t5xxl_path: String,
    pub problems: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ManagedFileManifest {
    pub relative_path: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub modified_at_epoch_secs: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FluxInstallManifest {
    pub schema_version: u32,
    pub generated_at: String,
    pub files: Vec<ManagedFileManifest>,
}
