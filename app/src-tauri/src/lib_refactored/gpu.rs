use std::process::{Command, Stdio};
use crate::lib_refactored::types::*;

pub fn version_at_least(version: &str, major: u32, minor: u32) -> bool {
    let mut it = version.split('.');
    let maj = it.next().and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    let min = it.next().and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    (maj, min) >= (major, minor)
}

pub fn parse_cuda_version_from_nvidia_smi(output: &str) -> Option<String> {
    for chunk in output.split("CUDA Version:").skip(1) {
        let v = chunk.trim_start();
        let end = v
            .find(|c: char| c == ' ' || c == '\n' || c == '\r' || c == '\t')
            .unwrap_or(v.len());
        let s = v[..end].trim();
        if !s.is_empty() {
            return Some(s.to_string());
        }
    }
    None
}

pub fn parse_driver_version_from_nvidia_smi(output: &str) -> Option<String> {
    for chunk in output.split("Driver Version:").skip(1) {
        let v = chunk.trim_start();
        let end = v
            .find(|c: char| c == ' ' || c == '\n' || c == '\r' || c == '\t')
            .unwrap_or(v.len());
        let s = v[..end].trim();
        if !s.is_empty() {
            return Some(s.to_string());
        }
    }
    None
}

pub fn linux_gpu_preflight(min_total_vram_gib: u64) -> GpuPreflight {
    if !cfg!(target_os = "linux") {
        return GpuPreflight::NotLinux;
    }

    let base_output = match Command::new("nvidia-smi")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        Ok(out) => out,
        Err(e) => {
            return GpuPreflight::LinuxNvidia {
                ok: false,
                cuda_version: None,
                driver_version: None,
                gpus: vec![],
                error: Some(format!("nvidia-smi not available: {e}")),
                messages: vec![
                    "NVIDIA GPU was not detected (nvidia-smi is unavailable). Training is disabled.".to_string(),
                ],
            };
        }
    };

    let base_stdout = String::from_utf8_lossy(&base_output.stdout).to_string();
    let base_stderr = String::from_utf8_lossy(&base_output.stderr).to_string();
    if !base_output.status.success() {
        let err = format!(
            "nvidia-smi failed (exit {:?}). {} {}",
            base_output.status.code(),
            base_stdout.trim(),
            base_stderr.trim()
        )
        .trim()
        .to_string();
        return GpuPreflight::LinuxNvidia {
            ok: false,
            cuda_version: parse_cuda_version_from_nvidia_smi(&base_stdout),
            driver_version: parse_driver_version_from_nvidia_smi(&base_stdout),
            gpus: vec![],
            error: Some(err),
            messages: vec!["Could not validate NVIDIA GPU. Training is disabled.".to_string()],
        };
    }

    let cuda_version = parse_cuda_version_from_nvidia_smi(&base_stdout);
    let driver_version = parse_driver_version_from_nvidia_smi(&base_stdout);

    let query_output = match Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        Ok(out) => out,
        Err(e) => {
            return GpuPreflight::LinuxNvidia {
                ok: false,
                cuda_version,
                driver_version,
                gpus: vec![],
                error: Some(format!("Failed to run nvidia-smi query: {e}")),
                messages: vec![
                    "Could not query NVIDIA GPU details. Training is disabled.".to_string()
                ],
            };
        }
    };

    if !query_output.status.success() {
        let qerr = format!(
            "nvidia-smi query failed (exit {:?}). {}",
            query_output.status.code(),
            String::from_utf8_lossy(&query_output.stderr).trim()
        )
        .trim()
        .to_string();
        return GpuPreflight::LinuxNvidia {
            ok: false,
            cuda_version,
            driver_version,
            gpus: vec![],
            error: Some(qerr),
            messages: vec!["Could not query NVIDIA GPU details. Training is disabled.".to_string()],
        };
    }

    let mut gpus: Vec<GpuInfo> = Vec::new();
    for line in String::from_utf8_lossy(&query_output.stdout).lines() {
        let mut parts = line.split(',').map(|s| s.trim());
        let name = parts.next().unwrap_or("").to_string();
        let mem = parts
            .next()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        if !name.is_empty() && mem > 0 {
            gpus.push(GpuInfo {
                name,
                memory_total_mib: mem,
            });
        }
    }

    if gpus.is_empty() {
        return GpuPreflight::LinuxNvidia {
            ok: false,
            cuda_version,
            driver_version,
            gpus,
            error: Some("No GPUs reported by nvidia-smi.".to_string()),
            messages: vec!["No NVIDIA GPU detected. Training is disabled.".to_string()],
        };
    }

    let min_mib = min_total_vram_gib.saturating_mul(1024);
    let has_sufficient = gpus.iter().any(|g| g.memory_total_mib >= min_mib);
    let mut messages: Vec<String> = Vec::new();
    if !has_sufficient {
        messages.push(format!(
            "Detected NVIDIA GPU(s), but none meet the minimum VRAM requirement ({} GiB). Training is disabled.",
            min_total_vram_gib
        ));
    }

    GpuPreflight::LinuxNvidia {
        ok: has_sufficient,
        cuda_version,
        driver_version,
        gpus,
        error: None,
        messages,
    }
}

pub fn select_linux_cuda_variant(settings: &AppSettings, gpu: &GpuPreflight) -> String {
    let requested = settings.linux_cuda_variant.trim().to_lowercase();
    if requested == "cu118" || requested == "cu121" {
        return requested;
    }
    if requested != "auto" {
        return "cu118".to_string();
    }

    if let GpuPreflight::LinuxNvidia { cuda_version, .. } = gpu {
        if let Some(v) = cuda_version {
            if version_at_least(v, 12, 1) {
                return "cu121".to_string();
            }
        }
    }
    "cu118".to_string()
}

pub fn detect_cuda_variant_from_nvidia_smi() -> Option<String> {
    let out = Command::new("nvidia-smi")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let v = parse_cuda_version_from_nvidia_smi(&stdout)?;
    if version_at_least(&v, 12, 8) {
        return Some("cu128".to_string());
    }
    if version_at_least(&v, 12, 6) {
        return Some("cu126".to_string());
    }
    if version_at_least(&v, 12, 4) {
        return Some("cu124".to_string());
    }
    if version_at_least(&v, 12, 1) {
        return Some("cu121".to_string());
    }
    Some("cu118".to_string())
}
