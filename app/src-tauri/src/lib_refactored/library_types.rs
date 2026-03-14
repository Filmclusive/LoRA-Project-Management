use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Library {
    pub schema_version: u32,
    pub projects: Vec<Project>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub folders: Vec<FolderNode>,
    #[serde(default)]
    pub assets: Vec<Asset>,
    pub characters: Vec<Character>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderNode {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub key: String,
    pub kind: String,
    pub order: i32,
    pub pinned: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Asset {
    pub id: Uuid,
    pub name: String,
    pub asset_type: String,
    pub folder_id: Uuid,
    pub model_family: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub dataset_image_count: u32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub trigger_tokens: Vec<String>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub training_steps_override: Option<u32>,
    #[serde(default)]
    pub source_character_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Character {
    pub id: Uuid,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub image_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectSummary {
    pub id: Uuid,
    pub name: String,
    pub updated_at: String,
    pub asset_count: u32,
    pub character_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharacterSummary {
    pub id: Uuid,
    pub name: String,
    pub updated_at: String,
    pub image_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderSummary {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub key: String,
    pub kind: String,
    pub order: i32,
    pub pinned: bool,
    pub asset_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetSummary {
    pub id: Uuid,
    pub name: String,
    pub asset_type: String,
    pub folder_id: Uuid,
    pub model_family: String,
    pub created_at: String,
    pub updated_at: String,
    pub dataset_image_count: u32,
    pub tags: Vec<String>,
    pub trigger_tokens: Vec<String>,
    pub notes: String,
    pub status: String,
    pub version_count: u32,
    pub last_trained_at: Option<String>,
    pub source_character_id: Option<Uuid>,
    pub training_steps_override: Option<u32>,
}
