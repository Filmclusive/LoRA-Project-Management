use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SystemConfig {
    pub schema_version: u32,

    pub install_root: PathBuf,
    pub engine_root: PathBuf,
    pub python_root: PathBuf,
    pub python_executable: PathBuf,
    pub venv_root: PathBuf,
    pub venv_python: PathBuf,
    pub sd_scripts_dir: PathBuf,
    pub comfyui_dir: PathBuf,

    pub accelerate_config_path: PathBuf,
    pub wheelhouse_dir: PathBuf,

    pub models_root: PathBuf,
    pub models_sdxl_root: PathBuf,
    pub models_wd14_root: PathBuf,
    pub models_lora_root: PathBuf,

    pub projects_root: PathBuf,
}

impl Default for SystemConfig {
    fn default() -> Self {
        let install_root = default_install_root();
        Self::from_install_root(&install_root)
    }
}

fn default_install_root() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Filmclusive")
    } else if cfg!(target_os = "macos") {
        // Keep default consistent with existing app behavior (per-user app data),
        // but allow the PRD's fixed layout via config override later.
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library")
            .join("Application Support")
            .join("Filmclusive")
    } else {
        PathBuf::from(".").join("Filmclusive")
    }
}

impl SystemConfig {
    pub fn from_install_root(install_root: &Path) -> Self {
        let install_root = install_root.to_path_buf();
        let engine_root = install_root.join("engine");

        let (python_root, python_executable, venv_root, venv_python) =
            if cfg!(target_os = "windows") {
                // Windows has had multiple layouts over time. Prefer any existing paths,
                // otherwise default to the current "managed Python 3.12" layout used by Auto setup.
                let python_root_legacy = engine_root.join("python");
                let python_root_managed = engine_root.join("python312");
                let python_root = if python_root_legacy.join("python.exe").is_file() {
                    python_root_legacy
                } else if python_root_managed.join("python.exe").is_file() {
                    python_root_managed
                } else {
                    python_root_managed
                };
                let python_executable = python_root.join("python.exe");

                let venv_root_legacy = engine_root.join("venv");
                let venv_root_managed = engine_root.join(".venv");
                let venv_root = if venv_root_managed.is_dir() {
                    venv_root_managed
                } else if venv_root_legacy.is_dir() {
                    venv_root_legacy
                } else {
                    venv_root_managed
                };
                let venv_python = venv_root.join("Scripts").join("python.exe");

                (python_root, python_executable, venv_root, venv_python)
            } else {
                let python_root = engine_root.join("python");
                let python_executable = python_root.join("bin").join("python3");

                let venv_root = engine_root.join("venv");
                let venv_python = venv_root.join("bin").join("python");

                (python_root, python_executable, venv_root, venv_python)
            };

        let sd_scripts_dir = engine_root.join("sd-scripts");
        let comfyui_dir = engine_root.join("comfyui");
        let accelerate_config_path = engine_root.join("accelerate_config.yaml");
        let wheelhouse_dir = engine_root.join("wheels");

        let models_root = install_root.join("models");
        let models_sdxl_root = models_root.join("sdxl");
        let models_wd14_root = models_root.join("wd14");
        let models_lora_root = models_root.join("lora");

        let projects_root = install_root.join("projects");

        Self {
            schema_version: 1,
            install_root,
            engine_root,
            python_root,
            python_executable,
            venv_root,
            venv_python,
            sd_scripts_dir,
            comfyui_dir,
            accelerate_config_path,
            wheelhouse_dir,
            models_root,
            models_sdxl_root,
            models_wd14_root,
            models_lora_root,
            projects_root,
        }
    }

    pub fn load(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(SystemConfig::default());
        }
        let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str(&raw).map_err(|e| e.to_string())
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let raw = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, format!("{raw}\n")).map_err(|e| e.to_string())
    }
}
