use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, atomic::AtomicBool};
use std::process::{Child, Command, Stdio};
use std::collections::HashMap;

#[cfg(target_os = "windows")]
use windows::Win32::System::Power::{
    ES_AWAYMODE_REQUIRED, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED, EXECUTION_STATE,
    SetThreadExecutionState,
};

pub struct RunnerState {
    pub processes: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
    pub downloads: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
    pub cancelled_downloads: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    pub sleep_guards: Arc<Mutex<HashMap<String, SleepGuard>>>,
}

impl Default for RunnerState {
    fn default() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
            downloads: Arc::new(Mutex::new(HashMap::new())),
            cancelled_downloads: Arc::new(Mutex::new(HashMap::new())),
            sleep_guards: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub enum SleepGuard {
    #[cfg(target_os = "windows")]
    Windows(WindowsSleepGuard),
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    Process(Child),
}

impl SleepGuard {
    pub fn new(enabled: bool) -> Option<Self> {
        if !enabled { return None; }
        #[cfg(target_os = "windows")] { return WindowsSleepGuard::new().map(SleepGuard::Windows); }
        #[cfg(target_os = "macos")] { return spawn_keep_awake_process("caffeinate", &["-dims"]).map(SleepGuard::Process); }
        #[cfg(target_os = "linux")] { return spawn_keep_awake_process("systemd-inhibit", &["--what=idle:sleep", "--mode=block", "--why=Filmclusive training", "sleep", "infinity"]).map(SleepGuard::Process); }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))] { return None; }
    }
}

impl Drop for SleepGuard {
    fn drop(&mut self) {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            let SleepGuard::Process(child) = self;
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn spawn_keep_awake_process(command: &str, args: &[&str]) -> Option<Child> {
    Command::new(command).args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().ok()
}

#[cfg(target_os = "windows")]
pub struct WindowsSleepGuard;

#[cfg(target_os = "windows")]
impl WindowsSleepGuard {
    pub fn new() -> Option<Self> {
        let flags = ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED | ES_AWAYMODE_REQUIRED;
        let result = unsafe { SetThreadExecutionState(flags) };
        if result == EXECUTION_STATE(0) { return None; }
        Some(Self)
    }
}

#[cfg(target_os = "windows")]
impl Drop for WindowsSleepGuard {
    fn drop(&mut self) { let _ = unsafe { SetThreadExecutionState(ES_CONTINUOUS) }; }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct AppSettings {
    pub schema_version: u32,
    pub python_executable: String,
    pub sdxl_base_model_path: String,
    pub sdxl_vae_path: Option<String>,
    pub blip_caption_weights_path: String,
    pub caption_backend: String,
    pub vision_caption_provider: String,
    pub ollama_base_url: String,
    pub ollama_vision_model: String,
    pub openai_compat_base_url: String,
    pub openai_compat_vision_model: String,
    pub mixed_precision: String,
    pub optimizer_type: String,
    pub linux_cuda_variant: String,
    pub default_export_dir: String,
    pub auto_export_after_training: bool,
    pub prompt_export_dir_on_train: bool,
    pub model_download_root: String,
    pub huggingface_token: String,
    pub preferred_flux_model_id: String,
    pub flux_model_catalog_version: u32,
    pub adapter_command: String,
    pub adapter_working_dir: String,
    #[serde(default)]
    pub adapter_args_template: Vec<String>,
    #[serde(default)]
    pub adapter_expected_outputs: Vec<String>,
    pub auto_steps_from_images: bool,
    pub steps_per_image: u32,
    pub min_auto_steps: u32,
    pub max_auto_steps: u32,
    pub prevent_sleep_during_training: bool,
    pub training_defaults: serde_json::Value,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 9,
            python_executable: "python3".to_string(),
            sdxl_base_model_path: "".to_string(),
            sdxl_vae_path: None,
            blip_caption_weights_path: "".to_string(),
            caption_backend: "sidecar".to_string(),
            vision_caption_provider: "ollama".to_string(),
            ollama_base_url: "http://localhost:11434".to_string(),
            ollama_vision_model: "qwen2.5vl:7b".to_string(),
            openai_compat_base_url: "http://localhost:1234".to_string(),
            openai_compat_vision_model: "".to_string(),
            mixed_precision: "fp16".to_string(),
            optimizer_type: "AdamW".to_string(),
            linux_cuda_variant: "auto".to_string(),
            default_export_dir: "".to_string(),
            auto_export_after_training: true,
            prompt_export_dir_on_train: false,
            model_download_root: "".to_string(),
            huggingface_token: "".to_string(),
            preferred_flux_model_id: "".to_string(),
            flux_model_catalog_version: 1,
            adapter_command: "".to_string(),
            adapter_working_dir: "".to_string(),
            adapter_args_template: vec![],
            adapter_expected_outputs: vec!["*.safetensors".to_string()],
            auto_steps_from_images: true,
            steps_per_image: 100,
            min_auto_steps: 100,
            max_auto_steps: 6000,
            prevent_sleep_during_training: false,
            training_defaults: serde_json::json!({}),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub memory_total_mib: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum GpuPreflight {
    NotLinux,
    LinuxNvidia {
        ok: bool,
        cuda_version: Option<String>,
        driver_version: Option<String>,
        gpus: Vec<GpuInfo>,
        error: Option<String>,
        messages: Vec<String>,
    },
}

#[derive(Debug, Serialize)]
pub struct DatasetImageEntry {
    pub file_name: String,
    pub display_name: String,
    pub image_path: String,
    pub thumb_path: Option<String>,
    pub original_path: Option<String>,
    pub caption_path: String,
    pub has_caption: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PresetFile {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub recommended_images: RecommendedImages,
    pub dataset_policy: DatasetPolicy,
    pub caption_policy: Option<CaptionPolicy>,
    pub training: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecommendedImages { pub min: u32, pub target: u32, pub max: u32 }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DatasetPolicy { pub requires_faces: bool }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CaptionPolicy { pub inject_terms: Option<Vec<String>>, pub avoid_terms: Option<Vec<String>>, pub bias_groups: Option<Vec<String>> }

#[derive(Debug, Serialize)]
pub struct PresetPublic {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub recommended_images: RecommendedImages,
    pub dataset_policy: DatasetPolicy,
    pub caption_policy: Option<CaptionPolicy>,
    pub training: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct SdScriptsReport {
    pub ok: bool,
    pub sd_scripts_dir: String,
    pub sdxl_train_network_py: bool,
    pub flux_train_network_py: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct InstallSdScriptsReport { pub ok: bool, pub steps: Vec<String>, pub sd_scripts_dir: String }

#[derive(Debug, Clone, serde::Deserialize)]
pub struct InstallPytorchArgs { pub channel: String, pub cuda: String }

pub enum BootstrapPythonFailure { Missing, Unsupported { details: String } }

#[derive(Debug, Serialize)]
pub struct RunArtifactsStatus {
    pub run_dir: String,
    pub has_config_snapshot: bool,
    pub has_dataset_manifest: bool,
    pub has_dataset_config: bool,
    pub has_kohya_config: bool,
    pub safetensors: Vec<String>,
    pub primary_safetensors_path: Option<String>,
    pub artifact_paths: crate::lib_refactored::model_types::ArtifactPaths,
}
