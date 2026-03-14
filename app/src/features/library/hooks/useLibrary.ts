import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteRunDir,
  deleteAsset,
  getAssetPaths,
  getCaptionStatus,
  listAssetModels,
  listAssets,
  listFolders,
  openPathInFinder,
  runArtifactsStatus,
  type AssetModelSummary,
  type AssetPaths,
  type AssetSummary,
  type CaptionStatusReport,
  type FolderSummary,
  type RunArtifactsStatus,
} from "@filmclusive/orchestrator";
import {
  initialTrainingProgress,
  type TrainingProgress,
} from "../../../lib/trainingProgress";
import {
  WorkspaceTab,
  LoadState,
  OperationStatus,
  PendingExport,
  branchAssetCount,
  collectFolderBranch,
  presetMatchesAsset,
} from "../components/LibraryUtils";
import { useLibraryActions } from "./useLibraryActions";
import { useLibraryRunner } from "./useLibraryRunner";

export function useLibrary(
  selectedProjectId: string | null,
  presets: any[],
  selectedPresetId: string | null,
  setSelectedPresetId: (id: string) => void,
  settings: any,
) {
  const [status, setStatus] = useState<LoadState>({ kind: "idle" });
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [mobileAssetsOpen, setMobileAssetsOpen] = useState(true);
  const [assetPaths, setAssetPaths] = useState<AssetPaths | null>(null);
  const [assetModels, setAssetModels] = useState<AssetModelSummary[]>([]);
  const [captionStatus, setCaptionStatus] = useState<CaptionStatusReport | null>(null);
  const [artifactStatus, setArtifactStatus] = useState<RunArtifactsStatus | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("data");
  const [createAssetOpen, setCreateAssetOpen] = useState(false);
  const [importModelOpen, setImportModelOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<string>("prop");
  const [modelFamily, setModelFamily] = useState<string>("sdxl");
  const [importMode, setImportMode] = useState<"copy" | "link">("copy");
  const [pendingImportPath, setPendingImportPath] = useState("");
  const [triggerTokensDraft, setTriggerTokensDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [trainingStepsOverrideDraft, setTrainingStepsOverrideDraft] = useState("");
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [savingTrainingOverride, setSavingTrainingOverride] = useState(false);
  const [runningAction, setRunningAction] = useState<string>("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>(() => initialTrainingProgress());
  const [isTrainingRunActive, setIsTrainingRunActive] = useState(false);
  const [pendingExport, setPendingExport] = useState<PendingExport>(null);
  const [deleteModelIntent, setDeleteModelIntent] = useState<AssetModelSummary | null>(null);
  const [deleteModelStatus, setDeleteModelStatus] = useState<OperationStatus>({ kind: "idle" });
  const [deleteAssetIntent, setDeleteAssetIntent] = useState<AssetSummary | null>(null);
  const [deleteAssetStatus, setDeleteAssetStatus] = useState<OperationStatus>({ kind: "idle" });

  const reloadLibrary = useCallback(async (projectId = selectedProjectId) => {
    if (!projectId) {
      setFolders([]);
      setAssets([]);
      return;
    }
    setStatus({ kind: "loading", message: "Loading assets…" });
    try {
      const [nextFolders, nextAssets] = await Promise.all([listFolders({ projectId }), listAssets({ projectId })]);
      setFolders(nextFolders);
      setAssets(nextAssets);
      setStatus({ kind: "idle" });
      if (!selectedDepartmentId) {
        const firstDepartment = nextFolders.find((folder) => !folder.parent_id && folder.kind === "department");
        setSelectedDepartmentId(firstDepartment?.id ?? null);
      }
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    }
  }, [selectedProjectId, selectedDepartmentId]);

  useEffect(() => {
    void reloadLibrary();
    setSelectedAssetId(null);
    setAssetPaths(null);
    setAssetModels([]);
    setCaptionStatus(null);
    setArtifactStatus(null);
    setWorkspaceTab("data");
  }, [selectedProjectId, reloadLibrary]);

  useEffect(() => {
    setMobileAssetsOpen(true);
  }, [selectedProjectId]);

  const departmentFolders = useMemo(
    () => folders.filter((folder) => !folder.parent_id && folder.kind === "department").sort((a, b) => a.order - b.order),
    [folders],
  );

  const departmentAssetCounts = useMemo(() => {
    const next = new Map<string, number>();
    for (const department of departmentFolders) {
      next.set(department.id, branchAssetCount(folders, assets, department.id));
    }
    return next;
  }, [assets, departmentFolders, folders]);

  const branchFolders = useMemo(
    () => collectFolderBranch(folders, selectedDepartmentId),
    [folders, selectedDepartmentId],
  );

  const branchFolderIds = useMemo(() => new Set(branchFolders.map((folder) => folder.id)), [branchFolders]);

  const visibleAssets = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const inScope = selectedDepartmentId ? branchFolderIds.has(asset.folder_id) : true;
      if (!inScope) return false;
      if (!normalizedQuery) return true;
      return [asset.name, asset.asset_type, asset.model_family, asset.tags.join(" "), asset.trigger_tokens.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [assets, branchFolderIds, search, selectedDepartmentId]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  useEffect(() => {
    if (!visibleAssets.length) {
      setSelectedAssetId(null);
      return;
    }
    if (visibleAssets.some((asset) => asset.id === selectedAssetId)) return;
    setSelectedAssetId(visibleAssets[0]?.id ?? null);
    setWorkspaceTab("data");
  }, [visibleAssets, selectedAssetId]);

  const compatiblePresets = useMemo(
    () => presets.filter((preset) => presetMatchesAsset(preset, selectedAsset)),
    [presets, selectedAsset],
  );

  useEffect(() => {
    if (!compatiblePresets.length) return;
    if (selectedPresetId && compatiblePresets.some((preset) => preset.id === selectedPresetId)) return;
    setSelectedPresetId(compatiblePresets[0]!.id);
  }, [compatiblePresets, selectedPresetId, setSelectedPresetId]);

  useEffect(() => {
    if (!selectedAsset || !selectedProjectId) {
      setAssetPaths(null);
      setAssetModels([]);
      setCaptionStatus(null);
      setArtifactStatus(null);
      return;
    }

    let mounted = true;
    const loadAsset = async () => {
      try {
        const [paths, models] = await Promise.all([
          getAssetPaths({ projectId: selectedProjectId, assetId: selectedAsset.id }),
          listAssetModels({ projectId: selectedProjectId, assetId: selectedAsset.id }),
        ]);
        if (!mounted) return;
        setAssetPaths(paths);
        setAssetModels(models);
        setTriggerTokensDraft(selectedAsset.trigger_tokens.join(", "));
        setTagsDraft(selectedAsset.tags.join(", "));
        setNotesDraft(selectedAsset.notes);
        setTrainingStepsOverrideDraft(
          selectedAsset.training_steps_override && selectedAsset.training_steps_override > 0
            ? String(selectedAsset.training_steps_override)
            : "",
        );

        const datasetReport = await getCaptionStatus({ datasetDir: paths.images_dir }).catch(() => null);
        if (!mounted) return;
        setCaptionStatus(datasetReport);

        const latestRun = models.find((model) => Boolean(model.run_dir));
        if (latestRun?.run_dir) {
          const runStatus = await runArtifactsStatus({ runDir: latestRun.run_dir }).catch(() => null);
          if (!mounted) return;
          setArtifactStatus(runStatus);
        } else {
          setArtifactStatus(null);
        }
      } catch (error) {
        if (!mounted) return;
        setStatus({ kind: "error", message: String(error) });
      }
    };

    void loadAsset();
    return () => {
      mounted = false;
    };
  }, [selectedAssetId, selectedProjectId, selectedAsset?.updated_at]);

  const refreshSelectedAsset = useCallback(async () => {
    if (!selectedProjectId || !selectedAsset) return;
    const [nextAssets, models] = await Promise.all([
      listAssets({ projectId: selectedProjectId }),
      listAssetModels({ projectId: selectedProjectId, assetId: selectedAsset.id }),
    ]);
    setAssets(nextAssets);
    setAssetModels(models);
    if (assetPaths) {
      const nextCaption = await getCaptionStatus({ datasetDir: assetPaths.images_dir }).catch(() => null);
      setCaptionStatus(nextCaption);
    }
    const latestRun = models.find((model) => Boolean(model.run_dir));
    if (latestRun?.run_dir) {
      const nextRunStatus = await runArtifactsStatus({ runDir: latestRun.run_dir }).catch(() => null);
      setArtifactStatus(nextRunStatus);
    } else {
      setArtifactStatus(null);
    }
  }, [assetPaths, selectedAsset, selectedProjectId]);

  async function safeOpenPath(path: string, label = "Open") {
    const target = path.trim();
    if (!target) return;
    try {
      await openPathInFinder({ path: target });
    } catch (error) {
      setStatus({ kind: "error", message: `${label} failed: ${String(error)}` });
    }
  }

  async function safeRevealItem(path: string, label = "Reveal") {
    const target = path.trim();
    if (!target) return;
    try {
      await openPathInFinder({ path: target });
    } catch (error) {
      setStatus({ kind: "error", message: `${label} failed: ${String(error)}` });
    }
  }

  const latestRunModel = useMemo(() => assetModels.find((model) => Boolean(model.run_dir)) ?? null, [assetModels]);
  const canTrain = Boolean(selectedAsset && assetPaths && selectedPresetId);
  const isNativeTraining = selectedAsset ? selectedAsset.model_family === "sdxl" || selectedAsset.model_family === "sd15" : false;

  useLibraryRunner(
    activeRunId,
    selectedProjectId,
    selectedAsset,
    pendingExport,
    refreshSelectedAsset,
    setActiveRunId,
    setIsTrainingRunActive,
    setTrainingProgress,
    setRunningAction,
    setPendingExport,
    setStatus,
    safeRevealItem,
  );

  const requestModelDelete = useCallback((model: AssetModelSummary) => {
    setDeleteModelStatus({ kind: "idle" });
    setDeleteModelIntent(model);
  }, []);

  const confirmModelDelete = useCallback(async () => {
    if (!deleteModelIntent?.run_dir) return;
    setDeleteModelStatus({ kind: "loading" });
    try {
      await deleteRunDir({ runDir: deleteModelIntent.run_dir });
    } catch (error) {
      setDeleteModelStatus({ kind: "error", message: String(error) });
      return;
    }
    setDeleteModelIntent(null);
    setDeleteModelStatus({ kind: "idle" });
    try {
      await refreshSelectedAsset();
    } catch (error) {
      setStatus({ kind: "error", message: `Failed to refresh runs: ${String(error)}` });
    }
  }, [deleteModelIntent, refreshSelectedAsset]);

  const requestAssetDelete = useCallback(() => {
    if (!selectedAsset) return;
    setDeleteAssetStatus({ kind: "idle" });
    setDeleteAssetIntent(selectedAsset);
  }, [selectedAsset]);

  const confirmAssetDelete = useCallback(async () => {
    if (!selectedProjectId || !deleteAssetIntent) return;
    setDeleteAssetStatus({ kind: "loading" });
    try {
      await deleteAsset({ projectId: selectedProjectId, assetId: deleteAssetIntent.id });
    } catch (error) {
      setDeleteAssetStatus({ kind: "error", message: String(error) });
      return;
    }
    setDeleteAssetIntent(null);
    setDeleteAssetStatus({ kind: "idle" });
    setSelectedAssetId(null);
    setAssetPaths(null);
    setAssetModels([]);
    setCaptionStatus(null);
    setArtifactStatus(null);
    setWorkspaceTab("data");
    try {
      await reloadLibrary(selectedProjectId);
    } catch (error) {
      setStatus({ kind: "error", message: `Failed to refresh assets: ${String(error)}` });
    }
  }, [deleteAssetIntent, reloadLibrary, selectedProjectId]);

  const actions = useLibraryActions(
    selectedProjectId,
    selectedDepartmentId,
    selectedAsset,
    selectedPresetId,
    settings,
    assetPaths,
    latestRunModel,
    isNativeTraining,
    setStatus,
    setRunningAction,
    setAssetName,
    setCreateAssetOpen,
    setSelectedAssetId,
    setImportModelOpen,
    setPendingImportPath,
    setSavingMetadata,
    setSavingTrainingOverride,
    setWorkspaceTab,
    setPendingExport,
    setActiveRunId,
    reloadLibrary,
    refreshSelectedAsset,
    assetName,
    assetType,
    modelFamily,
    importMode,
    pendingImportPath,
    triggerTokensDraft,
    tagsDraft,
    notesDraft,
    trainingStepsOverrideDraft,
  );

  return {
    status, setStatus,
    folders,
    assets,
    search, setSearch,
    selectedDepartmentId, setSelectedDepartmentId,
    selectedAssetId, setSelectedAssetId,
    mobileAssetsOpen, setMobileAssetsOpen,
    assetPaths,
    assetModels,
    captionStatus,
    artifactStatus,
    workspaceTab, setWorkspaceTab,
    createAssetOpen, setCreateAssetOpen,
    importModelOpen, setImportModelOpen,
    assetName, setAssetName,
    assetType, setAssetType,
    modelFamily, setModelFamily,
    importMode, setImportMode,
    pendingImportPath, setPendingImportPath,
    triggerTokensDraft, setTriggerTokensDraft,
    tagsDraft, setTagsDraft,
    notesDraft, setNotesDraft,
    trainingStepsOverrideDraft, setTrainingStepsOverrideDraft,
    savingMetadata,
    savingTrainingOverride,
    runningAction, setRunningAction,
    activeRunId,
    trainingProgress,
    isTrainingRunActive,
    pendingExport,
    deleteModelIntent, setDeleteModelIntent,
    deleteModelStatus,
    deleteAssetIntent, setDeleteAssetIntent,
    deleteAssetStatus,
    reloadLibrary,
    refreshSelectedAsset,
    departmentFolders,
    departmentAssetCounts,
    branchFolders,
    visibleAssets,
    selectedAsset,
    compatiblePresets,
    latestRunModel,
    canTrain,
    safeOpenPath,
    requestModelDelete,
    confirmModelDelete,
    requestAssetDelete,
    confirmAssetDelete,
    ...actions,
    openDialog,
  };
}
