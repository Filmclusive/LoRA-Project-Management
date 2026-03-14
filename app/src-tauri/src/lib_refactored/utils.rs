use std::path::{Path, PathBuf};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use std::process::{Command, Stdio, Output};
use sha2::{Digest, Sha256};
use crate::lib_refactored::types::{AppSettings, Asset, Project};
use crate::lib_refactored::paths::{effective_model_download_root, huggingface_cache_root};

pub fn utc_now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    chrono::DateTime::<chrono::Utc>::from_timestamp(secs as i64, 0)
        .unwrap_or_else(|| chrono::Utc::now())
        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn merged_json(base: &serde_json::Value, overlay: &serde_json::Value) -> serde_json::Value {
    match (base, overlay) {
        (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
            let mut out = a.clone();
            for (key, value) in b {
                let next = if let Some(existing) = out.get(key) {
                    merged_json(existing, value)
                } else {
                    value.clone()
                };
                out.insert(key.clone(), next);
            }
            serde_json::Value::Object(out)
        }
        (_, other) => other.clone(),
    }
}

pub fn file_modified_epoch_secs(path: &Path) -> Result<u64, String> {
    let modified = fs::metadata(path)
        .map_err(|e| e.to_string())?
        .modified()
        .map_err(|e| e.to_string())?;
    modified
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|e| e.to_string())
}

pub fn sha256_file_hex(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn read_json_file(path: &Path) -> Option<serde_json::Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn write_json_file(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, format!("{raw}\n")).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn apply_model_download_env(command: &mut Command, root: &Path, settings: &AppSettings) -> Result<(), String> {
    let download_root = effective_model_download_root(root, settings);
    let hf_home = huggingface_cache_root(root, settings);
    let hub_cache = hf_home.join("hub");

    command.env("FILMCLUSIVE_MODEL_DOWNLOAD_ROOT", download_root);
    command.env("HF_HOME", &hf_home);
    command.env("HUGGINGFACE_HUB_CACHE", &hub_cache);
    command.env("HF_HUB_CACHE", &hub_cache);

    let token = settings.huggingface_token.trim();
    if !token.is_empty() {
        command.env("HUGGINGFACE_HUB_TOKEN", token);
        command.env("HF_TOKEN", token);
    }
    Ok(())
}

pub fn safe_project_name(name: &str) -> String {
    let filtered: String = name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '_' | '-'))
        .collect();
    let cleaned = filtered
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    if cleaned.is_empty() {
        "Untitled Project".to_string()
    } else {
        cleaned
    }
}

pub fn safe_path_segment(name: &str, fallback: &str) -> String {
    let filtered: String = name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '_' | '-'))
        .collect();
    let cleaned = filtered
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    if cleaned.is_empty() {
        fallback.to_string()
    } else {
        cleaned
    }
}

pub fn friendly_asset_type_name(value: &str) -> String {
    if value.eq_ignore_ascii_case("actor") {
        return "Character".to_string();
    }
    if value.eq_ignore_ascii_case("costume") {
        return "Wardrobe".to_string();
    }
    if value.eq_ignore_ascii_case("hair-makeup") {
        return "Hair & Makeup".to_string();
    }
    value
        .split('-')
        .map(|part| {
            if part.is_empty() {
                return String::new();
            }
            let lower = part.to_ascii_lowercase();
            let mut chars = lower.chars();
            let first = chars.next().unwrap();
            format!("{first}{rest}", first = first.to_ascii_uppercase(), rest = chars.as_str())
        })
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn safe_filename_component(value: &str, fallback: &str) -> String {
    safe_path_segment(value, fallback).replace(' ', "_")
}

pub fn create_model_export_filename(project: &Project, asset: &Asset, extension: &str) -> String {
    let asset_type_label = friendly_asset_type_name(&asset.asset_type);
    let extension = extension.trim_start_matches('.');
    let extension = if extension.is_empty() {
        "safetensors"
    } else {
        extension
    };
    let extension = extension.to_ascii_lowercase();
    let project_segment = safe_filename_component(&project.name, "Project");
    let asset_type_segment = safe_filename_component(&asset_type_label, "AssetType");
    let asset_name_segment = safe_filename_component(&asset.name, "Asset");
    format!(
        "{project_segment}-{asset_type_segment}-{asset_name_segment}.{extension}",
    )
}

pub fn is_run_version_dir(name: &str) -> bool {
    if name.len() != 4 {
        return false;
    }
    let mut chars = name.chars();
    if chars.next() != Some('v') {
        return false;
    }
    chars.all(|ch| ch.is_ascii_digit())
}

pub fn ensure_within_allowed_open_roots(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    let root_can = root.canonicalize().map_err(|e| e.to_string())?;
    let cand_can = candidate.canonicalize().map_err(|e| e.to_string())?;

    if cand_can.starts_with(&root_can) {
        return Ok(cand_can);
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            if !home.trim().is_empty() {
                let home_can = PathBuf::from(home)
                    .canonicalize()
                    .map_err(|e| e.to_string())?;
                if cand_can.starts_with(&home_can) {
                    return Ok(cand_can);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(home) = std::env::var("USERPROFILE") {
            if !home.trim().is_empty() {
                let home_can = PathBuf::from(home)
                    .canonicalize()
                    .map_err(|e| e.to_string())?;
                if cand_can.starts_with(&home_can) {
                    return Ok(cand_can);
                }
            }
        }
    }

    Err("Not allowed to open path.".to_string())
}

pub fn ensure_within_library_root(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    let root_can = root.canonicalize().map_err(|e| e.to_string())?;
    let cand_can = candidate.canonicalize().map_err(|e| e.to_string())?;
    if !cand_can.starts_with(&root_can) {
        return Err("Path is outside the Filmclusive library root.".to_string());
    }
    Ok(cand_can)
}

pub fn platform_name() -> &'static str {
    if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "unknown"
    }
}

pub fn push_output_lines(steps: &mut Vec<String>, label: &str, output: &Output) {
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            steps.push(format!("{label}: {trimmed}"));
        }
    }
    for line in String::from_utf8_lossy(&output.stderr).lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            steps.push(format!("{label}: {trimmed}"));
        }
    }
    if steps.len() > 200 {
        let keep = steps.split_off(steps.len().saturating_sub(200));
        *steps = keep;
    }
}

pub fn run_command_steps(
    cwd: &Path,
    program: &str,
    args: &[&str],
    envs: &[(&str, String)],
    label: &str,
    steps: &mut Vec<String>,
) -> Result<(), String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (k, v) in envs {
        command.env(k, v);
    }
    let output = command
        .output()
        .map_err(|e| format!("{label} failed to start: {e}"))?;
    push_output_lines(steps, label, &output);
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "{label} failed with exit code {:?}",
            output.status.code()
        ))
    }
}

pub fn run_command_steps_vec(
    cwd: &Path,
    program: &str,
    args: &[String],
    envs: &[(&str, String)],
    label: &str,
    steps: &mut Vec<String>,
) -> Result<(), String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (k, v) in envs {
        command.env(k, v);
    }
    let output = command
        .output()
        .map_err(|e| format!("{label} failed to start: {e}"))?;
    push_output_lines(steps, label, &output);
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "{label} failed with exit code {:?}",
            output.status.code()
        ))
    }
}

pub fn path_has_wheels(dir: &Path) -> bool {
    if !dir.is_dir() {
        return false;
    }
    match fs::read_dir(dir) {
        Ok(entries) => entries.flatten().any(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.eq_ignore_ascii_case("whl"))
                .unwrap_or(false)
        }),
        Err(_) => false,
    }
}

pub fn escape_powershell_single_quotes(value: &str) -> String {
    value.replace('\'', "''")
}
