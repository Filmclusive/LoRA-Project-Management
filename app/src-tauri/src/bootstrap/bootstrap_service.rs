use crate::config::system_config::SystemConfig;
use crate::system::{runtime_for_current_platform, GpuReport};

#[derive(Debug, Clone, serde::Serialize)]
pub struct BootstrapReport {
    pub ok: bool,
    pub steps: Vec<String>,
    pub gpus: Option<GpuReport>,
}

pub struct BootstrapService;

impl BootstrapService {
    pub fn bootstrap(cfg: &SystemConfig) -> Result<BootstrapReport, String> {
        let rt = runtime_for_current_platform();
        let mut steps: Vec<String> = Vec::new();

        steps.push(format!("Install root: {}", cfg.install_root.display()));
        steps.push(format!("Engine root: {}", cfg.engine_root.display()));

        rt.create_venv(cfg)?;
        steps.push("Virtual environment ready.".to_string());

        // Dependency install is intentionally strict about offline wheelhouse presence.
        rt.install_dependencies(cfg)?;
        steps.push("Pinned dependencies installed.".to_string());

        let gpus = rt.detect_gpus(cfg).ok();
        if let Some(report) = &gpus {
            let count = report.device_count;
            rt.write_accelerate_config(cfg, count.max(1))?;
            steps.push(format!("Accelerate config written for {count} GPU(s)."));
        } else {
            rt.write_accelerate_config(cfg, 1)?;
            steps.push("Accelerate config written for 1 process.".to_string());
        }

        Ok(BootstrapReport {
            ok: true,
            steps,
            gpus,
        })
    }
}
