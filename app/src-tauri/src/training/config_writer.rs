#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainConfig {
    pub schema_version: u32,
    pub preset_id: String,
    pub seed: u64,
    pub sdxl_base_model_path: PathBuf,
    pub wd14_model_dir: Option<PathBuf>,
    pub dataset_dir: PathBuf,
    pub output_dir: PathBuf,
    pub output_name: String,
    pub accelerate_config_path: Option<PathBuf>,
    pub cuda_visible_devices: Option<String>,
}

impl TrainConfig {
    pub fn write_to_run_dir(&self, run_dir: &Path) -> Result<PathBuf, String> {
        std::fs::create_dir_all(run_dir).map_err(|e| e.to_string())?;
        let path = run_dir.join("train_config.json");
        let raw = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&path, format!("{raw}\n")).map_err(|e| e.to_string())?;
        Ok(path)
    }
}
