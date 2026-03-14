#![allow(dead_code)]

use crate::config::system_config::SystemConfig;
use crate::system::{runtime_for_current_platform, EvalLaunchArgs, SpawnedJob};

pub struct EvaluationService;

impl EvaluationService {
    pub fn spawn_comfyui_headless(
        cfg: &SystemConfig,
        workflow_path: &str,
        output_dir: &str,
        cuda_visible_devices: Option<String>,
    ) -> Result<SpawnedJob, String> {
        let rt = runtime_for_current_platform();
        let comfy_main = cfg.comfyui_dir.join("main.py");
        if !comfy_main.exists() {
            return Err(format!(
                "ComfyUI not found (expected at {}). Engine comfyui is not initialized.",
                comfy_main.display()
            ));
        }
        rt.run_evaluation(
            cfg,
            &EvalLaunchArgs {
                script_path: comfy_main.to_string_lossy().to_string(),
                script_args: vec![
                    "--headless".to_string(),
                    "--workflow".to_string(),
                    workflow_path.to_string(),
                    "--output-directory".to_string(),
                    output_dir.to_string(),
                ],
                cuda_visible_devices,
            },
        )
    }
}
