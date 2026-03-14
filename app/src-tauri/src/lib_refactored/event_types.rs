use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgressEvent {
    #[serde(rename = "downloadId")]
    pub download_id: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "bytesDownloaded")]
    pub bytes_downloaded: u64,
    #[serde(rename = "totalBytes")]
    pub total_bytes: u64,
    pub percent: f64,
    pub phase: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "state")]
pub enum DownloadStatusEvent {
    #[serde(rename = "started")]
    Started {
        #[serde(rename = "downloadId")]
        download_id: String,
        #[serde(rename = "modelId")]
        model_id: String,
        message: String,
    },
    #[serde(rename = "completed")]
    Completed {
        #[serde(rename = "downloadId")]
        download_id: String,
        #[serde(rename = "modelId")]
        model_id: String,
        message: String,
    },
    #[serde(rename = "failed")]
    Failed {
        #[serde(rename = "downloadId")]
        download_id: String,
        #[serde(rename = "modelId")]
        model_id: String,
        message: String,
    },
    #[serde(rename = "paused")]
    Paused {
        #[serde(rename = "downloadId")]
        download_id: String,
        #[serde(rename = "modelId")]
        model_id: String,
        message: String,
    },
}

#[derive(Debug, Serialize, Clone)]
pub struct RunnerLogEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    pub line: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "state")]
pub enum RunnerStatusEvent {
    #[serde(rename = "started")]
    Started {
        #[serde(rename = "runId")]
        run_id: String,
    },
    #[serde(rename = "completed")]
    Completed {
        #[serde(rename = "runId")]
        run_id: String,
        #[serde(rename = "exitCode")]
        exit_code: i32,
    },
    #[serde(rename = "failed")]
    Failed {
        #[serde(rename = "runId")]
        run_id: String,
        message: String,
    },
}
