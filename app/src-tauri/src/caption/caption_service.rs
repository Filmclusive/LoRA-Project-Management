#![allow(dead_code)]

use crate::config::system_config::SystemConfig;
use crate::system::{runtime_for_current_platform, CaptionLaunchArgs, SpawnedJob};

pub struct CaptionService;

impl CaptionService {
    pub fn spawn_wd14_tagging(
        cfg: &SystemConfig,
        dataset_dir: &str,
        preset_id: &str,
    ) -> Result<SpawnedJob, String> {
        // Placeholder: wire up a real WD14 entrypoint once sd-scripts is vendored into engine/sd-scripts.
        // Keeping it explicit prevents any implicit runtime downloads.
        let rt = runtime_for_current_platform();
        let script = cfg
            .sd_scripts_dir
            .join("finetune")
            .join("tag_images_by_wd14_tagger.py");
        if !script.exists() {
            return Err(format!(
                "WD14 tagging script not found (expected at {}). Engine sd-scripts is not initialized.",
                script.display()
            ));
        }
        rt.run_caption_job(
            cfg,
            &CaptionLaunchArgs {
                script_path: script.to_string_lossy().to_string(),
                script_args: vec![
                    "--train_data_dir".to_string(),
                    dataset_dir.to_string(),
                    "--model_dir".to_string(),
                    cfg.models_wd14_root.to_string_lossy().to_string(),
                    "--caption_extension".to_string(),
                    ".txt".to_string(),
                    "--preset_id".to_string(),
                    preset_id.to_string(),
                ],
            },
        )
    }
}
