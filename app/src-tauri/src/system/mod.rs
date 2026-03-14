#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::{Child, Command, Stdio};

use crate::config::system_config::SystemConfig;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "windows")]
pub use windows::WindowsRuntime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuDevice {
    pub index: u32,
    pub name: Option<String>,
    #[serde(rename = "totalMemoryMiB")]
    pub total_memory_mib: Option<u64>,
    #[serde(rename = "computeCapabilityMajor")]
    pub compute_capability_major: Option<u32>,
    #[serde(rename = "computeCapabilityMinor")]
    pub compute_capability_minor: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuReport {
    pub ok: bool,
    pub cuda_available: bool,
    pub device_count: u32,
    pub devices: Vec<GpuDevice>,
    pub torch_version: Option<String>,
    #[serde(rename = "torchCudaVersion")]
    pub torch_cuda_version: Option<String>,
    #[serde(rename = "torchSupportedArchList")]
    pub torch_supported_arch_list: Option<Vec<String>>,
    pub error: Option<String>,
}

#[derive(Debug)]
pub struct SpawnedJob {
    pub child: Child,
}

pub trait SystemRuntime: Send + Sync {
    fn detect_gpus(&self, cfg: &SystemConfig) -> Result<GpuReport, String>;
    fn create_venv(&self, cfg: &SystemConfig) -> Result<(), String>;
    fn install_dependencies(&self, cfg: &SystemConfig) -> Result<(), String>;
    fn write_accelerate_config(&self, cfg: &SystemConfig, gpu_count: u32) -> Result<(), String>;

    fn run_training_job(
        &self,
        cfg: &SystemConfig,
        args: &TrainingLaunchArgs,
    ) -> Result<SpawnedJob, String>;
    fn run_caption_job(
        &self,
        cfg: &SystemConfig,
        args: &CaptionLaunchArgs,
    ) -> Result<SpawnedJob, String>;
    fn run_evaluation(
        &self,
        cfg: &SystemConfig,
        args: &EvalLaunchArgs,
    ) -> Result<SpawnedJob, String>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingLaunchArgs {
    pub accelerate_config_path: String,
    pub script_path: String,
    pub script_args: Vec<String>,
    pub cuda_visible_devices: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionLaunchArgs {
    pub script_path: String,
    pub script_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalLaunchArgs {
    pub script_path: String,
    pub script_args: Vec<String>,
    pub cuda_visible_devices: Option<String>,
}

pub fn runtime_for_current_platform() -> Box<dyn SystemRuntime> {
    #[cfg(target_os = "windows")]
    {
        return Box::new(WindowsRuntime {});
    }

    #[cfg(not(target_os = "windows"))]
    {
        Box::new(PortableRuntime {})
    }
}

struct PortableRuntime;

impl SystemRuntime for PortableRuntime {
    fn detect_gpus(&self, cfg: &SystemConfig) -> Result<GpuReport, String> {
        torch_probe(cfg.venv_python.as_path())
            .or_else(|_| torch_probe(cfg.python_executable.as_path()))
    }

    fn create_venv(&self, cfg: &SystemConfig) -> Result<(), String> {
        if cfg.venv_python.exists() {
            return Ok(());
        }
        if let Some(parent) = cfg.venv_root.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let python = cfg.python_executable.as_path();
        if !python.exists() {
            return Err(format!(
                "Bundled Python executable not found: {}",
                python.display()
            ));
        }
        let status = Command::new(python)
            .arg("-m")
            .arg("venv")
            .arg(&cfg.venv_root)
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!("Failed to create venv (exit {:?}).", status.code()));
        }
        Ok(())
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

fn torch_probe(python: &Path) -> Result<GpuReport, String> {
    if !python.exists() {
        return Err(format!("Python not found: {}", python.display()));
    }
     let code = r#"
import json, sys

out = {
  "ok": True,
  "cuda_available": False,
  "device_count": 0,
  "devices": [],
  "torch_version": None,
  "torchCudaVersion": None,
  "torchSupportedArchList": None,
  "error": None,
}

try:
  import torch
  out["torch_version"] = getattr(torch, "__version__", None)
  out["torchCudaVersion"] = getattr(getattr(torch, "version", None), "cuda", None)
  out["cuda_available"] = bool(torch.cuda.is_available())
  if out["cuda_available"]:
    out["torchSupportedArchList"] = list(torch.cuda.get_arch_list() or [])
    out["device_count"] = int(torch.cuda.device_count())
    for i in range(torch.cuda.device_count()):
      props = torch.cuda.get_device_properties(i)
      cap = None
      try:
        cap = torch.cuda.get_device_capability(i)
      except Exception:
        cap = None
      device = {
        "index": i,
        "name": getattr(props, "name", None),
        "totalMemoryMiB": int(getattr(props, "total_memory", 0) / (1024*1024)) if getattr(props, "total_memory", None) is not None else None,
        "computeCapabilityMajor": cap[0] if cap else None,
        "computeCapabilityMinor": cap[1] if cap else None,
      }
      out["devices"].append(device)
except Exception as e:
  out["ok"] = False
  out["error"] = str(e)

json.dump(out, sys.stdout)
"#;

    let output = Command::new(python)
        .arg("-c")
        .arg(code)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "GPU probe failed (exit {:?}): {}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim()).map_err(|e| format!("Invalid GPU probe JSON: {e}"))
}

fn install_pinned_python_deps(cfg: &SystemConfig) -> Result<(), String> {
    if !cfg.venv_python.exists() {
        return Err("Venv python not found. Create the venv first.".to_string());
    }
    let wheelhouse = cfg.wheelhouse_dir.as_path();
    if !wheelhouse.is_dir() {
        return Err(format!(
            "Offline wheelhouse not found: {}. Place pinned wheels here before installing.",
            wheelhouse.display()
        ));
    }

    let mut cmd = Command::new(&cfg.venv_python);
    cmd.arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--no-index")
        .arg("--find-links")
        .arg(wheelhouse)
        .arg("--upgrade")
        .arg("pip")
        .arg("setuptools")
        .arg("wheel");
    let status = cmd.status().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("pip bootstrap failed (exit {:?}).", status.code()));
    }

    // NOTE: Windows CUDA wheels use local-version tags (e.g. 2.1.2+cu118), which must be pinned
    // explicitly for offline installs.
    let torch_pins: Vec<&'static str> = if cfg!(target_os = "windows") {
        vec![
            "torch==2.1.2+cu118",
            "torchvision==0.16.2+cu118",
            "xformers==0.0.22.post7",
        ]
    } else {
        vec![
            "torch==2.1.2",
            "torchvision==0.16.2",
            "xformers==0.0.22.post7",
        ]
    };

    let mut install_torch = Command::new(&cfg.venv_python);
    install_torch
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--no-index")
        .arg("--find-links")
        .arg(wheelhouse)
        .args(torch_pins);

    let status = install_torch.status().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!(
            "pip torch install failed (exit {:?}).",
            status.code()
        ));
    }

    // Install sd-scripts (kohya) requirements from the pinned wheelhouse when available.
    let req = cfg.sd_scripts_dir.join("requirements.txt");
    if req.is_file() {
        let mut install_reqs = Command::new(&cfg.venv_python);
        install_reqs
            .arg("-m")
            .arg("pip")
            .arg("install")
            .arg("--no-index")
            .arg("--find-links")
            .arg(wheelhouse)
            .arg("-r")
            .arg(req);
        let status = install_reqs.status().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!(
                "pip sd-scripts requirements install failed (exit {:?}).",
                status.code()
            ));
        }
    } else {
        // Minimal pinned set for engine bootstrap when sd-scripts isn't present yet.
        let pinned = [
            "accelerate==0.24.1",
            "transformers==4.36.2",
            "diffusers==0.24.0",
            "safetensors==0.4.2",
        ];
        let mut install = Command::new(&cfg.venv_python);
        install
            .arg("-m")
            .arg("pip")
            .arg("install")
            .arg("--no-index")
            .arg("--find-links")
            .arg(wheelhouse)
            .args(pinned);
        let status = install.status().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!(
                "pip dependency install failed (exit {:?}).",
                status.code()
            ));
        }
    }

    Ok(())
}

pub(crate) fn write_accelerate_config_file(
    path: &Path,
    gpu_count: u32,
    mixed_precision: &str,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let gpu_count = gpu_count.max(1);

    // NOTE:
    // - On Windows, torch.distributed can fail early with:
    //   "use_libuv was requested but PyTorch was build without libuv support"
    //   when launched via torchrun/elastic. To keep training working out of the box,
    //   default to non-distributed accelerate config on Windows.
    // - Users can force MULTI_GPU on Windows by setting FILMCLUSIVE_ACCELERATE_MULTIGPU=1
    //   (at their own risk depending on their PyTorch build).
    let force_multigpu = std::env::var("FILMCLUSIVE_ACCELERATE_MULTIGPU")
        .ok()
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let enable_multigpu = gpu_count > 1 && (!cfg!(target_os = "windows") || force_multigpu);
    let distributed_type = if enable_multigpu { "MULTI_GPU" } else { "NO" };
    let num_processes = if enable_multigpu { gpu_count } else { 1 };

    // Accelerate config schema is stable enough for local-machine launch.
    // Keep keys minimal for the chosen distributed type.
    let body = if enable_multigpu {
        format!(
            "compute_environment: LOCAL_MACHINE\n\
distributed_type: {distributed_type}\n\
downcast_bf16: 'no'\n\
gpu_ids: all\n\
machine_rank: 0\n\
main_process_ip: 127.0.0.1\n\
main_process_port: 29500\n\
main_training_function: main\n\
mixed_precision: {mixed_precision}\n\
num_machines: 1\n\
num_processes: {num_processes}\n\
rdzv_backend: static\n\
same_network: true\n\
tpu_env: []\n\
tpu_use_cluster: false\n\
tpu_use_sudo: false\n\
use_cpu: false\n"
        )
    } else {
        format!(
            "compute_environment: LOCAL_MACHINE\n\
distributed_type: {distributed_type}\n\
downcast_bf16: 'no'\n\
gpu_ids: all\n\
machine_rank: 0\n\
main_training_function: main\n\
mixed_precision: {mixed_precision}\n\
num_machines: 1\n\
num_processes: {num_processes}\n\
tpu_env: []\n\
tpu_use_cluster: false\n\
tpu_use_sudo: false\n\
use_cpu: false\n"
        )
    };

    std::fs::write(path, body).map_err(|e| e.to_string())
}

pub(crate) fn apply_python_utf8_env(cmd: &mut Command) {
    // Prevent Unicode log output from crashing under Windows cp1252 consoles.
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
}

fn spawn_accelerate(cfg: &SystemConfig, args: &TrainingLaunchArgs) -> Result<SpawnedJob, String> {
    if !cfg.venv_python.exists() {
        return Err(format!(
            "Venv python not found: {}",
            cfg.venv_python.display()
        ));
    }
    let mut cmd = Command::new(&cfg.venv_python);
    cmd.arg("-m")
        .arg("accelerate.commands.launch")
        .arg("--config_file")
        .arg(&args.accelerate_config_path)
        .arg(&args.script_path)
        .args(&args.script_args)
        .current_dir(&cfg.sd_scripts_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(devices) = &args.cuda_visible_devices {
        cmd.env("CUDA_VISIBLE_DEVICES", devices);
    }
    apply_python_utf8_env(&mut cmd);

    let child = cmd.spawn().map_err(|e| e.to_string())?;
    Ok(SpawnedJob { child })
}

fn spawn_python_job(
    cfg: &SystemConfig,
    script_path: &str,
    script_args: &[String],
    cuda_visible_devices: Option<String>,
) -> Result<SpawnedJob, String> {
    if !cfg.venv_python.exists() {
        return Err(format!(
            "Venv python not found: {}",
            cfg.venv_python.display()
        ));
    }
    let mut cmd = Command::new(&cfg.venv_python);
    cmd.arg(script_path)
        .args(script_args)
        .current_dir(&cfg.engine_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(devices) = cuda_visible_devices {
        cmd.env("CUDA_VISIBLE_DEVICES", devices);
    }
    apply_python_utf8_env(&mut cmd);
    let child = cmd.spawn().map_err(|e| e.to_string())?;
    Ok(SpawnedJob { child })
}
