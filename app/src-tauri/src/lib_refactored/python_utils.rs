use std::path::{Path, PathBuf};
use std::fs;
use std::process::{Command, Stdio};
use tauri::Manager;
use crate::lib_refactored::types::*;
use crate::lib_refactored::paths::*;
use crate::lib_refactored::utils::*;

pub fn bundled_python_executable(app: &tauri::AppHandle, _settings: &AppSettings) -> Option<PathBuf> {
    let resource_dir = app.path().resource_dir().ok()?;
    let base = resource_dir.join("python-runtime");

    let candidates: Vec<PathBuf> = if cfg!(target_os = "windows") {
        vec![
            base.join("python.exe"),
            base.join("Scripts").join("python.exe"),
            base.join("bin").join("python.exe"),
        ]
    } else {
        vec![
            base.join("bin").join("python3"),
            base.join("bin").join("python"),
            base.join("python3"),
            base.join("python"),
        ]
    };

    candidates.into_iter().find(|p| p.is_file())
}

pub fn effective_python_executable(app: &tauri::AppHandle, root: &Path, settings: &AppSettings) -> String {
    let configured = settings.python_executable.trim();
    if !configured.is_empty() && configured != "python3" {
        return configured.to_string();
    }

    if let Some(bundled) = bundled_python_executable(app, settings) {
        return bundled.to_string_lossy().to_string();
    }

    let managed = managed_python_executable(root);
    if managed.is_file() {
        return managed.to_string_lossy().to_string();
    }

    if configured.is_empty() {
        "python3".to_string()
    } else {
        configured.to_string()
    }
}

pub fn parse_python_version(output: &std::process::Output) -> Option<(u32, u32, u32)> {
    fn parse(text: &str) -> Option<(u32, u32, u32)> {
        let idx = text.find("Python ")?;
        let after = &text[idx + "Python ".len()..];
        let version_token = after.split_whitespace().next()?;
        let mut parts = version_token.split('.');
        let major: u32 = parts.next()?.parse().ok()?;
        let minor: u32 = parts.next()?.parse().ok()?;
        let patch: u32 = parts.next().unwrap_or("0").parse().ok().unwrap_or(0);
        Some((major, minor, patch))
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    parse(&stdout).or_else(|| parse(&stderr))
}

pub fn python_version_supported(version: (u32, u32, u32)) -> bool {
    let (major, minor, _patch) = version;
    major == 3 && minor >= 11 && minor <= 13
}

pub fn python_version_is_312(version: (u32, u32, u32)) -> bool {
    let (major, minor, _patch) = version;
    major == 3 && minor == 12
}

pub fn detect_bootstrap_python(
    settings: &AppSettings,
    steps: &mut Vec<String>,
) -> Result<String, BootstrapPythonFailure> {
    let candidates = if cfg!(target_os = "windows") {
        vec![
            settings.python_executable.clone(),
            "python".to_string(),
            "python3".to_string(),
            "py".to_string(),
        ]
    } else {
        vec![
            settings.python_executable.clone(),
            "python3".to_string(),
            "python3.12".to_string(),
            "python3.11".to_string(),
            "python3.13".to_string(),
            "python".to_string(),
        ]
    };

    let mut tried = Vec::new();
    for cmd in candidates {
        if cmd.trim().is_empty() || tried.contains(&cmd) {
            continue;
        }
        tried.push(cmd.clone());
        let out = Command::new(&cmd)
            .arg("--version")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output();
        match out {
            Ok(out) if out.status.success() => {
                if let Some(version) = parse_python_version(&out) {
                    if python_version_supported(version) {
                        steps.push(format!("Found suitable bootstrap Python: {cmd}"));
                        return Ok(cmd);
                    } else {
                        steps.push(format!(
                            "Python at {cmd} is an unsupported version: {}.{}.{}",
                            version.0, version.1, version.2
                        ));
                    }
                }
            }
            _ => {}
        }
    }

    Err(BootstrapPythonFailure::Missing)
}

pub fn ensure_windows_python_312(
    _repo_root: &Path,
    root: &Path,
    steps: &mut Vec<String>,
) -> Result<String, String> {
    if !cfg!(target_os = "windows") {
        return Err("Automatic Python install is only supported on Windows.".to_string());
    }

    const PYTHON_VERSION: &str = "3.12.8";
    const PYTHON_INSTALLER: &str = "python-3.12.8-amd64.exe";
    let url = format!("https://www.python.org/ftp/python/{PYTHON_VERSION}/{PYTHON_INSTALLER}");

    let python_exe = windows_managed_python_312_executable(root);
    if python_exe.exists() {
        let out = Command::new(&python_exe)
            .arg("--version")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| e.to_string())?;
        push_output_lines(steps, "python312-version", &out);
        if out.status.success() {
            if let Some(version) = parse_python_version(&out) {
                if python_version_is_312(version) {
                    return Ok(python_exe.to_string_lossy().to_string());
                }
            }
        }
    }

    let installer_dir = root.join("engine").join("installers");
    fs::create_dir_all(&installer_dir).map_err(|e| e.to_string())?;
    let installer_path = installer_dir.join(PYTHON_INSTALLER);
    if !installer_path.is_file() {
        steps.push(format!("Downloading Python {PYTHON_VERSION}…"));
        let mut child = Command::new("curl");
        child
            .arg("-L")
            .arg("--fail")
            .arg("--retry")
            .arg("4")
            .arg("--output")
            .arg(&installer_path)
            .arg(&url);
        let out = child.output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(format!("Failed to download Python installer: {}", String::from_utf8_lossy(&out.stderr)));
        }
    }

    steps.push(format!("Installing Python {PYTHON_VERSION}…"));
    let install_dir = windows_managed_python_312_dir(root);
    let mut install = Command::new(&installer_path);
    install
        .arg("/quiet")
        .arg("InstallAllUsers=0")
        .arg("Include_launcher=0")
        .arg("Include_test=0")
        .arg("SimpleInstall=1")
        .arg(format!("TargetDir={}", install_dir.display()));
    let out = install.output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(format!("Python installation failed: {}", String::from_utf8_lossy(&out.stderr)));
    }

    if python_exe.exists() {
        Ok(python_exe.to_string_lossy().to_string())
    } else {
        Err("Python installed but executable not found.".to_string())
    }
}
