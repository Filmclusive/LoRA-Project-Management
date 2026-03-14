use crate::config::system_config::SystemConfig;
use crate::system::{
    install_pinned_python_deps, spawn_accelerate, spawn_python_job, torch_probe,
    write_accelerate_config_file, CaptionLaunchArgs, EvalLaunchArgs, GpuReport, SpawnedJob,
    SystemRuntime, TrainingLaunchArgs,
};

pub struct WindowsRuntime;

impl SystemRuntime for WindowsRuntime {
    fn detect_gpus(&self, cfg: &SystemConfig) -> Result<GpuReport, String> {
        // Prefer the venv if already initialized; otherwise probe the bundled python directly.
        torch_probe(cfg.venv_python.as_path())
            .or_else(|_| torch_probe(cfg.python_executable.as_path()))
    }

    fn create_venv(&self, cfg: &SystemConfig) -> Result<(), String> {
        // Portable implementation already accounts for Windows venv layout.
        let portable = super::PortableRuntime {};
        portable.create_venv(cfg)
    }

    fn install_dependencies(&self, cfg: &SystemConfig) -> Result<(), String> {
        install_pinned_python_deps(cfg)
    }

    fn write_accelerate_config(&self, cfg: &SystemConfig, gpu_count: u32) -> Result<(), String> {
        write_accelerate_config_file(cfg.accelerate_config_path.as_path(), gpu_count, "fp16")
    }

    fn run_training_job(
        &self,
        cfg: &SystemConfig,
        args: &TrainingLaunchArgs,
    ) -> Result<SpawnedJob, String> {
        spawn_accelerate(cfg, args)
    }

    fn run_caption_job(
        &self,
        cfg: &SystemConfig,
        args: &CaptionLaunchArgs,
    ) -> Result<SpawnedJob, String> {
        spawn_python_job(cfg, &args.script_path, &args.script_args, None)
    }

    fn run_evaluation(
        &self,
        cfg: &SystemConfig,
        args: &EvalLaunchArgs,
    ) -> Result<SpawnedJob, String> {
        spawn_python_job(
            cfg,
            &args.script_path,
            &args.script_args,
            args.cuda_visible_devices.clone(),
        )
    }
}
