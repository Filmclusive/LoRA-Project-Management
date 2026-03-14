#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainJob {
    pub project_id: String,
    pub run_id: String,
    pub preset_id: String,
    pub seed: u64,
    pub gpu_selection: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetThroughputTuning {
    pub network_dim: u32,
    pub network_alpha: u32,
    pub train_text_encoder: bool,
}

pub fn tuning_for_preset(preset_id: &str, vram_gb: Option<u32>) -> PresetThroughputTuning {
    // Conservative defaults; refined tuning happens in the Python engine and sd-scripts config.
    let high_vram = vram_gb.unwrap_or(0) >= 48;
    let standard_vram = vram_gb.unwrap_or(0) >= 24;

    let wants_high_fidelity =
        preset_id.to_lowercase().contains("high") || preset_id.to_lowercase().contains("fidelity");
    let (dim, alpha) = if wants_high_fidelity && (high_vram || standard_vram) {
        (64, 32)
    } else if standard_vram {
        (32, 32)
    } else {
        (16, 16)
    };

    PresetThroughputTuning {
        network_dim: dim,
        network_alpha: alpha,
        train_text_encoder: true,
    }
}

pub fn scaled_batch_size(base_batch_size: u32, gpu_count: u32) -> u32 {
    base_batch_size.saturating_mul(gpu_count.max(1))
}
