use std::path::{Path, PathBuf};
use std::fs;
use std::process::{Command, Stdio, Output};
use std::collections::VecDeque;
use tauri::Manager;
use crate::lib_refactored::types::*;
use crate::lib_refactored::utils::*;

pub fn looks_like_repo_root(dir: &Path) -> bool {
    dir.join("presets").is_dir() && dir.join("runner").is_dir()
}

pub fn find_repo_root_in_resources(resource_dir: &Path) -> Option<PathBuf> {
    let quick_candidates = [
        resource_dir.to_path_buf(),
        resource_dir.join("resources"),
        resource_dir.join("_up_"),
        resource_dir.join("_up_").join("_up_"),
    ];
    for c in quick_candidates {
        if looks_like_repo_root(&c) {
            return Some(c);
        }
    }

    let mut stack: Vec<(PathBuf, u8)> = vec![(resource_dir.to_path_buf(), 0)];
    let mut seen: usize = 0;
    while let Some((dir, depth)) = stack.pop() {
        if depth > 6 {
            continue;
        }
        if looks_like_repo_root(&dir) {
            return Some(dir);
        }
        let Ok(rd) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in rd.flatten() {
            if seen > 4000 {
                return None;
            }
            seen += 1;
            let p = entry.path();
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if !meta.is_dir() {
                continue;
            }
            if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                if name == "python-runtime" || name == ".background" {
                    continue;
                }
            }
            stack.push((p, depth + 1));
        }
    }
    None
}

pub fn find_repo_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(v) = std::env::var("FILMCLUSIVE_REPO_ROOT") {
        let candidate = PathBuf::from(v);
        if looks_like_repo_root(&candidate) {
            return Ok(candidate);
        }
    }

    let mut start_dirs: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = std::env::current_dir() {
        start_dirs.push(dir);
    }
    if let Ok(dir) = app.path().resource_dir() {
        start_dirs.push(dir.clone());
        start_dirs.push(dir.join("resources"));
        if let Some(parent) = dir.parent() {
            start_dirs.push(parent.to_path_buf());
        }
    }
    if let Ok(dir) = app.path().executable_dir() {
        start_dirs.push(dir.clone());
        if let Some(parent) = dir.parent() {
            start_dirs.push(parent.to_path_buf());
        }
    }

    for start in start_dirs {
        let mut dir = start;
        for _ in 0..12 {
            if looks_like_repo_root(&dir) {
                return Ok(dir);
            }
            if !dir.pop() {
                break;
            }
        }
    }

    if let Ok(res_dir) = app.path().resource_dir() {
        if let Some(found) = find_repo_root_in_resources(&res_dir) {
            return Ok(found);
        }
    }

    let cwd = std::env::current_dir()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let res_dir = app
        .path()
        .resource_dir()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    Err(format!(
        "Could not locate repo root (missing presets/ and runner/).\nCurrent dir: {cwd}\nResource dir: {res_dir}"
    ))
}

pub fn runner_script(repo_root: &Path) -> PathBuf {
    repo_root.join("runner").join("filmclusive_runner.py")
}

pub fn run_python_json_with_exec(
    repo_root: &Path,
    python_exec: &str,
    root: &Path,
    settings: &AppSettings,
    args: &[&str],
) -> Result<serde_json::Value, String> {
    let exec = python_exec.trim();
    if exec.is_empty() {
        return Err(filmclusive_error(
            "PYTHON_EXECUTABLE_MISSING",
            "Python executable is not configured.",
            &[
                "Run Auto setup in Settings > System.",
                "Or set the Python executable manually in Settings > System.",
            ],
            Some(format!(
                "settings.python_executable={}",
                settings.python_executable
            )),
        ));
    }

    let script = runner_script(repo_root);
    let mut command = Command::new(exec);
    command
        .arg(script)
        .args(args)
        .env("FILMCLUSIVE_REPO_ROOT", repo_root)
        .current_dir(repo_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_model_download_env(&mut command, root, settings)?;
    let output = command.output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(filmclusive_error(
            "RUNNER_FAILED",
            "Runner command failed.",
            &[
                "Run Auto setup in Settings > System.",
                "If this keeps failing, copy the error details and share them with a developer.",
            ],
            Some(format!(
                "python_executable={}\nargs={:?}\nexit={:?}\nstdout={}\nstderr={}",
                exec,
                args,
                output.status.code(),
                stdout.trim(),
                stderr.trim()
            )),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_runner_json_stdout(stdout.as_ref()).map_err(|e| {
        filmclusive_error(
            "RUNNER_JSON_INVALID",
            "Runner returned invalid JSON output.",
            &[
                "Retry the action.",
                "If it repeats, share the error details with a developer.",
            ],
            Some(format!(
                "python_executable={}\nargs={:?}\nparse_error={}\nstdout={}",
                exec,
                args,
                e,
                stdout.trim()
            )),
        )
    })
}

pub fn parse_runner_json_stdout(stdout: &str) -> Result<serde_json::Value, String> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Err("stdout is empty".to_string());
    }

    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
        return Ok(v);
    }

    for line in trimmed.lines().rev() {
        let candidate = line.trim();
        if candidate.is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(candidate) {
            return Ok(v);
        }
    }

    Err("expected value at line 1 column 1".to_string())
}

pub fn tail_text(path: &Path, max_lines: usize, max_chars: usize) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let mut dq: VecDeque<&str> = VecDeque::new();
    for line in raw.lines() {
        dq.push_back(line);
        while dq.len() > max_lines {
            let _ = dq.pop_front();
        }
    }
    let mut out = dq.into_iter().collect::<Vec<&str>>().join("\n");
    if out.len() > max_chars {
        let keep = max_chars.saturating_sub(3);
        out = format!("...{}", &out[out.len().saturating_sub(keep)..]);
    }
    Some(out)
}

pub fn filmclusive_error(
    code: &str,
    message: &str,
    next_steps: &[&str],
    details: Option<String>,
) -> String {
    let v = serde_json::json!({
        "code": code,
        "message": message,
        "details": details,
        "next_steps": next_steps,
    });
    format!("FILMCLUSIVE_ERROR:{}", v.to_string())
}

pub fn read_run_cuda_visible_devices(run_dir: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(run_dir.join("config_snapshot.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("training").and_then(|t| t.get("gpu_id")).and_then(|x| x.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

pub fn read_run_engine_key(run_dir: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(run_dir.join("config_snapshot.json")).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value.get("training").and_then(|t| t.get("engine")).and_then(|e| e.as_str()).map(|e| e.trim().to_string()).filter(|e| !e.is_empty())
}

pub fn read_run_model_architecture(run_dir: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(run_dir.join("config_snapshot.json")).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let t = value.get("training")?;
    t.get("model_architecture").and_then(|a| a.as_str()).or_else(|| t.get("model_family").and_then(|a| a.as_str())).map(|a| a.trim().to_lowercase()).filter(|a| !a.is_empty())
}

pub fn normalize_requested_engine(requested_engine: Option<String>, run_dir: &Path) -> Option<String> {
    match requested_engine.as_deref() {
        Some("adapter:flux") => Some("kohya".to_string()),
        Some(e) if e.starts_with("adapter:") && read_run_model_architecture(run_dir).as_deref() == Some("flux") => Some("kohya".to_string()),
        _ => requested_engine,
    }
}

pub fn kohya_entrypoint_name_for_run(run_dir: &Path) -> &'static str {
    match read_run_model_architecture(run_dir).as_deref() {
        Some("flux") => "flux_train_network.py",
        Some("sd3") => "sd3_train_network.py",
        Some("lumina") => "lumina_train_network.py",
        Some("hunyuan") => "hunyuan_image_train_network.py",
        Some("anima") => "anima_train_network.py",
        _ => "sdxl_train_network.py",
    }
}

pub fn run_cmd_output(mut cmd: Command) -> Result<Output, String> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.output().map_err(|e| e.to_string())
}
