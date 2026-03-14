import { FolderSummary, AssetSummary, PresetPublic } from "@filmclusive/orchestrator";
import { resolveTrainingEngineKey } from "../../../lib/trainingUiHelpers";

export type WorkspaceTab = "data" | "captions" | "models" | "usage";
export type LoadState = { kind: "idle" } | { kind: "loading"; message: string } | { kind: "error"; message: string };
export type OperationStatus = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };
export type PendingExport = { runId: string; destinationRoot?: string } | null;

export const ASSET_TYPES = [
  "actor",
  "prop",
  "set",
  "costume",
  "hair-makeup",
  "lens",
  "camera",
  "lighting",
  "vfx",
  "look",
] as const;

export const MODEL_FAMILIES = ["sdxl", "sd15", "flux", "other"] as const;

export function friendlyAssetType(value: string) {
  if (value === "actor") return "Character";
  if (value === "costume") return "Wardrobe";
  if (value === "hair-makeup") return "Hair & Makeup";
  return value
    .split("-")
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

export function formatWhen(iso?: string | null) {
  if (!iso) return "Not yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function presetMatchesAsset(preset: PresetPublic, asset: AssetSummary | null) {
  if (!asset) return true;
  const training = (preset.training ?? {}) as Record<string, unknown>;
  const modelFamily = typeof training.model_family === "string" ? training.model_family : "";
  if (modelFamily && modelFamily !== asset.model_family) return false;
  const assetTypes = Array.isArray(training.asset_types) ? training.asset_types.filter((value): value is string => typeof value === "string") : [];
  if (assetTypes.length > 0 && !assetTypes.includes(asset.asset_type)) return false;
  return true;
}

export function collectFolderBranch(folders: FolderSummary[], departmentId: string | null) {
  if (!departmentId) return [];
  const include = new Set<string>([departmentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parent_id && include.has(folder.parent_id) && !include.has(folder.id)) {
        include.add(folder.id);
        changed = true;
      }
    }
  }
  return folders.filter((folder) => include.has(folder.id)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function statusTone(status: string) {
  switch (status) {
    case "Trained":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "Imported":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700";
    case "Ready":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    default:
      return "border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-text-muted)]";
  }
}

export function engineForAsset(asset: AssetSummary | null) {
  if (!asset) return null;
  return resolveTrainingEngineKey({ engineMode: "auto", modelArchitectureOverride: "", assetModelFamily: asset.model_family });
}

export function folderLabel(folders: FolderSummary[], folderId: string) {
  return folders.find((folder) => folder.id === folderId)?.name ?? "Folder";
}

export function branchAssetCount(folders: FolderSummary[], assets: AssetSummary[], departmentId: string) {
  const folderIds = new Set(collectFolderBranch(folders, departmentId).map((folder) => folder.id));
  return assets.filter((asset) => folderIds.has(asset.folder_id)).length;
}
