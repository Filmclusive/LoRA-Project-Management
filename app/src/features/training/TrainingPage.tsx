import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAsset,
  createAssetRun,
  getCaptionStatus,
  getAssetPaths,
  deleteRunDir,
  listAssets,
  listFolders,
  onRunnerLog,
  onRunnerStatus,
  openPathInFinder,
  prepareTrainingPackage,
  runArtifactsStatus,
  startTrainingWithEngine,
  cancelTraining,
  setRunLabel,
  type AssetPaths,
  type AssetSummary,
  type CaptionStatusReport,
  type FolderSummary,
  type RunArtifactsStatus,
} from "@filmclusive/orchestrator";
import { TrainingProgressPanel } from "../../components/TrainingProgressPanel";
import { Modal } from "../../components/ui/Modal";
import {
  completeTrainingProgress,
  failTrainingProgress,
  formatProgressActionLabel,
  initialTrainingProgress,
  startTrainingProgress,
  type TrainingProgress,
  updateTrainingProgress,
} from "../../lib/trainingProgress";
import { useProjectContext } from "../../state/projectContext";
import { useSettingsContext } from "../../state/settingsContext";
import { useUserPreferences } from "../../state/userPreferences";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";
import { applyManagedFluxTrainingConfig, coerceTrainingConfig, DEFAULT_TRAINING_CONFIG, type TrainingConfig } from "../../state/trainingConfig";
import { computeAutoTrainingSteps } from "../../lib/autoSteps";
import { ensureTriggerInPrompt, resolveTrainingEngineKey } from "../../lib/trainingUiHelpers";

type UiStatus = { kind: "idle" } | { kind: "working"; message: string } | { kind: "error"; message: string };
type CleanupResult = { success: true } | { success: false; error: string };
type Quality = "fast" | "standard" | "high";
type AssetTabId =
  | "characters"
  | "props"
  | "wardrobe"
  | "setDeck"
  | "camera"
  | "lighting"
  | "hairMakeup"
  | "vfx"
  | "look"
  | "other";

const TRAINING_TABS: Array<{ id: AssetTabId; label: string; assetTypes: string[]; preferredFolderKeys: string[] }> = [
  { id: "characters", label: "Characters", assetTypes: ["actor"], preferredFolderKeys: ["actors"] },
  { id: "props", label: "Props", assetTypes: ["prop"], preferredFolderKeys: ["props"] },
  { id: "wardrobe", label: "Wardrobe", assetTypes: ["costume"], preferredFolderKeys: ["wardrobe", "accessories", "costumes"] },
  { id: "setDeck", label: "Set Deck", assetTypes: ["set"], preferredFolderKeys: ["set-dressing", "sets", "locations"] },
  { id: "camera", label: "Camera", assetTypes: ["camera", "lens"], preferredFolderKeys: ["lenses", "camera-bodies-profiles", "framing-composition", "camera-movement"] },
  { id: "lighting", label: "Lighting", assetTypes: ["lighting"], preferredFolderKeys: ["lighting-setups", "modifiers", "lighting-grip-electric"] },
  { id: "hairMakeup", label: "Hair & Makeup", assetTypes: ["hair-makeup"], preferredFolderKeys: ["hair-makeup"] },
  { id: "vfx", label: "VFX", assetTypes: ["vfx"], preferredFolderKeys: ["practical-fx", "cg-style", "vfx"] },
  { id: "look", label: "Look", assetTypes: ["look"], preferredFolderKeys: ["film-stock-emulsion", "grade-lut-like-look", "color-look"] },
  { id: "other", label: "Other", assetTypes: [], preferredFolderKeys: ["custom", "imported"] },
];

const CONFETTI_COLORS = ["#34d399", "#22c55e", "#facc15", "#fb7185", "#f472b6"];
const CONFETTI_COUNT = 24;

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      delay: -Math.random() * 2,
      duration: 2 + Math.random() * 1.2,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    }));
  }, [active]);
  if (!active) return null;
  return (
    <div className="confetti-overlay">
      {pieces.map((piece) => (
          <span
            key={piece.id}
            className="confetti-piece"
            style={{
              left: `${piece.left}%`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              backgroundColor: piece.color,
            }}
          />
      ))}
    </div>
  );
}

function applyQuality(base: TrainingConfig, q: Quality): TrainingConfig {
  const baseSteps = Math.max(1, Math.round(base.training_steps || DEFAULT_TRAINING_CONFIG.training_steps));
  const baseRank = Math.max(1, Math.round(base.rank || DEFAULT_TRAINING_CONFIG.rank));
  const baseAlpha = Math.max(1, Math.round(base.alpha || DEFAULT_TRAINING_CONFIG.alpha));
  if (q === "fast") {
    return {
      ...base,
      training_steps: Math.max(1, Math.round(baseSteps * 0.55)),
      rank: Math.max(1, Math.round(baseRank * 0.5)),
      alpha: Math.max(1, Math.round(baseAlpha * 0.5)),
    };
  }
  if (q === "high") {
    return {
      ...base,
      training_steps: Math.max(1, Math.round(baseSteps * 1.6)),
      rank: Math.max(1, Math.round(baseRank * 2)),
      alpha: Math.max(1, Math.round(baseAlpha * 2)),
    };
  }
  return { ...base, training_steps: baseSteps, rank: baseRank, alpha: baseAlpha };
}

function matchesTab(asset: AssetSummary, tabId: AssetTabId) {
  const tab = TRAINING_TABS.find((item) => item.id === tabId);
  if (!tab) return false;
  if (tab.assetTypes.length === 0) {
    return !TRAINING_TABS.some((item) => item.id !== "other" && item.assetTypes.includes(asset.asset_type));
  }
  return tab.assetTypes.includes(asset.asset_type);
}

function preferredFolderForTab(folders: FolderSummary[], tabId: AssetTabId) {
  const tab = TRAINING_TABS.find((item) => item.id === tabId);
  if (!tab) return null;
  for (const key of tab.preferredFolderKeys) {
    const match = folders.find((folder) => folder.key === key);
    if (match) return match;
  }
  return folders.find((folder) => !folder.parent_id) ?? folders[0] ?? null;
}

function engineForAsset(args: { asset: AssetSummary | null; training: TrainingConfig }) {
  const family = args.asset?.model_family ?? null;
  return resolveTrainingEngineKey({
    engineMode: args.training.engine,
    modelArchitectureOverride: args.training.model_architecture,
    assetModelFamily: family,
  });
}

export function TrainingPage(props: { onOpenSettings: () => void; isSetupPreview: boolean }) {
  const { selectedProjectId } = useProjectContext();
  const { settings, engineReport, runEngineCheck, selectedPresetId, selectedPreset, preferredFluxStatus } = useSettingsContext();
  const { preferences, updatePreferences } = useUserPreferences();

  const [ui, setUi] = useState<UiStatus>({ kind: "idle" });
  const [assetTab, setAssetTab] = useState<AssetTabId>(() => preferences.trainingAssetTab ?? "characters");
  const [assetQuery, setAssetQuery] = useState("");
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [quality, setQuality] = useState<Quality>("standard");
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>(() => ({ ...DEFAULT_TRAINING_CONFIG }));
  const [assetPaths, setAssetPaths] = useState<AssetPaths | null>(null);
  const [captionStatus, setCaptionStatus] = useState<CaptionStatusReport | null>(null);
  const [runDir, setRunDir] = useState("");
  const [runVersion, setRunVersion] = useState("");
  const [artifacts, setArtifacts] = useState<RunArtifactsStatus | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>(() => initialTrainingProgress());
  const [isTrainingRunActive, setIsTrainingRunActive] = useState(false);
  const [runNeedsRebuild, setRunNeedsRebuild] = useState(true);
  const [createAssetOpen, setCreateAssetOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [cancelingRunId, setCancelingRunId] = useState<string | null>(null);
  const [deleteRunModalOpen, setDeleteRunModalOpen] = useState(false);
  const [deleteRunLoading, setDeleteRunLoading] = useState(false);
  const [deleteRunError, setDeleteRunError] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successRunDir, setSuccessRunDir] = useState("");
  const [successRunVersion, setSuccessRunVersion] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [autoOpenedRunDir, setAutoOpenedRunDir] = useState<string | null>(null);
  const [lastCelebratedRun, setLastCelebratedRun] = useState<string | null>(null);
  const markRunNeedsRebuild = useCallback(() => setRunNeedsRebuild(true), []);
  const clearRunNeedsRebuild = useCallback(() => setRunNeedsRebuild(false), []);
  const handleTrainingConfigChange = useCallback(
    (nextConfig: TrainingConfig) => {
      setTrainingConfig(nextConfig);
      markRunNeedsRebuild();
    },
    [markRunNeedsRebuild],
  );

  useEffect(() => {
    if (preferences.trainingAssetTab === assetTab) return;
    updatePreferences({ trainingAssetTab: assetTab });
  }, [assetTab, preferences.trainingAssetTab, updatePreferences]);

  const cleanupRun = useCallback(
    async (targetRunDir: string): Promise<CleanupResult> => {
      if (!targetRunDir) {
        return { success: true };
      }
      setIsTrainingRunActive(false);
      try {
        await deleteRunDir({ runDir: targetRunDir });
      } catch (error) {
        return { success: false, error: String(error) };
      }
      setRunDir("");
      setRunVersion("");
      setArtifacts(null);
      setLogLines([]);
      setTrainingProgress(initialTrainingProgress());
      setSuccessModalOpen(false);
      setShowConfetti(false);
      setSuccessRunDir("");
      setSuccessRunVersion("");
      setAutoOpenedRunDir(null);
      setLastCelebratedRun(null);
      return { success: true };
    },
    []
  );

  const openRunDirectory = useCallback(
    async (targetPath?: string) => {
      const target = targetPath?.trim();
      if (!target) return;
      try {
        await openPathInFinder({ path: target });
      } catch (error) {
        setUi({ kind: "error", message: `Failed to open folder: ${String(error)}` });
      }
    },
    [setUi]
  );

  useEffect(() => {
    if (!settings) return;
    const base = applyManagedFluxTrainingConfig(coerceTrainingConfig(settings.training_defaults), settings, preferredFluxStatus);
    setTrainingConfig((prev) => applyQuality(base, quality) || prev);
    markRunNeedsRebuild();
  }, [markRunNeedsRebuild, preferredFluxStatus, quality, settings]);

  useEffect(() => {
    let unlistenLog: null | (() => void) = null;
    let unlistenStatus: null | (() => void) = null;
    (async () => {
      const l = await onRunnerLog((event) => {
        if (!runDir || event.runId !== runDir) return;
        setLogLines((prev) => [...prev, event.line].slice(-400));
        setTrainingProgress((prev) => updateTrainingProgress(prev, event.line));
      });
      const s = await onRunnerStatus(async (event) => {
        if (event.runId !== runDir) return;
        if (event.state === "started") {
          setIsTrainingRunActive(true);
          setTrainingProgress((prev) => {
            if (prev.startedAtMs && prev.phase !== "idle") return prev;
            return startTrainingProgress();
          });
          return;
        }
        if (event.state === "completed") {
          setIsTrainingRunActive(false);
          setTrainingProgress((prev) => completeTrainingProgress(prev));
          setUi({ kind: "idle" });
            if (runDir) {
              const nextArtifacts = await runArtifactsStatus({ runDir }).catch(() => null);
              setArtifacts(nextArtifacts);
            }
          }
        if (event.state === "failed") {
          if (cancelingRunId && event.runId === cancelingRunId) {
            setCancelingRunId(null);
            setIsTrainingRunActive(false);
            setTrainingProgress((prev) => ({ ...failTrainingProgress(prev), phaseLabel: "Training stopped" }));
            setUi({ kind: "idle" });
            try {
              await setRunLabel({ runDir: event.runId, label: "Partial (stopped)" });
            } catch {
              // best-effort: labeling isn't critical for stop behavior
            }
            const nextArtifacts = await runArtifactsStatus({ runDir: event.runId }).catch(() => null);
            setArtifacts(nextArtifacts);
            return;
          }
          setIsTrainingRunActive(false);
          setTrainingProgress((prev) => failTrainingProgress(prev));
          setUi({ kind: "error", message: event.message });
        }
      });
      unlistenLog = () => l();
      unlistenStatus = () => s();
    })().catch(() => {});
    return () => {
      unlistenLog?.();
      unlistenStatus?.();
    };
  }, [runDir, cleanupRun, cancelingRunId, autoOpenedRunDir, openRunDirectory, runVersion]);

  useEffect(() => {
    if (!showConfetti) return;
    const timer = window.setTimeout(() => setShowConfetti(false), 2800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [showConfetti]);

  useEffect(() => {
    if (!selectedProjectId) {
      setFolders([]);
      setAssets([]);
      return;
    }
    Promise.all([listFolders({ projectId: selectedProjectId }), listAssets({ projectId: selectedProjectId })])
      .then(([nextFolders, nextAssets]) => {
        setFolders(nextFolders);
        setAssets(nextAssets);
      })
      .catch((error) => setUi({ kind: "error", message: String(error) }));
  }, [selectedProjectId]);

  useEffect(() => {
    if (trainingProgress.phase !== "completed" || !runDir || lastCelebratedRun === runDir) {
      return;
    }
    setSuccessRunDir(runDir);
    setSuccessRunVersion(runVersion || "");
    setSuccessModalOpen(true);
    setShowConfetti(true);
    setLastCelebratedRun(runDir);
    void setRunLabel({ runDir, label: "Complete" }).catch(() => {});
    if (!autoOpenedRunDir) {
      setAutoOpenedRunDir(runDir);
      void openRunDirectory(runDir);
    }
  }, [trainingProgress.phase, runDir, runVersion, lastCelebratedRun, autoOpenedRunDir, openRunDirectory]);

  const filteredAssets = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    return assets
      .filter((asset) => matchesTab(asset, assetTab))
      .filter((asset) => (!q ? true : asset.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets, assetQuery, assetTab]);
  const selectedAsset = useMemo(() => filteredAssets.find((asset) => asset.id === selectedAssetId) ?? null, [filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (!filteredAssets.length) {
      setSelectedAssetId("");
      return;
    }
    if (!filteredAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(filteredAssets[0]!.id);
    }
  }, [filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedAssetId) {
      setAssetPaths(null);
      setCaptionStatus(null);
      setRunDir("");
      setRunVersion("");
      setArtifacts(null);
      setLogLines([]);
      setIsTrainingRunActive(false);
      setTrainingProgress(initialTrainingProgress());
      setCancelingRunId(null);
      setDeleteRunModalOpen(false);
      setDeleteRunLoading(false);
      setDeleteRunError(null);
      setSuccessModalOpen(false);
      setSuccessRunDir("");
      setSuccessRunVersion("");
      setShowConfetti(false);
      setAutoOpenedRunDir(null);
      setLastCelebratedRun(null);
      return;
    }
    Promise.all([getAssetPaths({ projectId: selectedProjectId, assetId: selectedAssetId })])
      .then(async ([paths]) => {
        setAssetPaths(paths);
        const nextCaptionStatus = await getCaptionStatus({ datasetDir: paths.images_dir }).catch(() => null);
        setCaptionStatus(nextCaptionStatus);
      })
      .catch((error) => setUi({ kind: "error", message: String(error) }));
  }, [selectedAssetId, selectedProjectId]);

  const systemBaseModelPath = settings?.sdxl_base_model_path?.trim() || "";
  const effectiveBaseModelPath = trainingConfig.model_name_or_path.trim() || systemBaseModelPath;
  const managedFluxRequired = settings?.preferred_flux_model_id === "flux1-schnell";
  const engineConfigured = Boolean(systemBaseModelPath) && (!managedFluxRequired || Boolean(preferredFluxStatus?.ready));
  const engineReady = engineConfigured && Boolean(engineReport?.ok);
  const captionsReady = Boolean(captionStatus?.ok);
  const canPrepareRun = Boolean(selectedAsset && selectedPresetId && captionStatus?.ok && ui.kind !== "working" && !props.isSetupPreview);
  const canTrain = Boolean(selectedAsset && selectedPresetId && captionsReady && engineReady && ui.kind !== "working" && !props.isSetupPreview);

  const userStepsOverride =
    selectedAsset && selectedAsset.training_steps_override && selectedAsset.training_steps_override > 0 ? selectedAsset.training_steps_override : null;
  const autoStepsBase =
    selectedAsset && settings?.auto_steps_from_images && selectedAsset.dataset_image_count > 0
      ? (() => {
          const repeats = trainingConfig.datasets[0]?.num_repeats ?? 1;
          return computeAutoTrainingSteps({
            imageCount: selectedAsset.dataset_image_count,
            repeats,
            stepsPerImage: settings.steps_per_image ?? 100,
            batchSize: trainingConfig.batch_size ?? 1,
            gradAcc: trainingConfig.gradient_accumulation_steps ?? 1,
            minSteps: settings.min_auto_steps ?? 100,
            maxSteps: settings.max_auto_steps ?? 6000,
          });
        })()
      : null;
  const autoSteps =
    autoStepsBase && settings
      ? (() => {
          const mult = quality === "fast" ? 0.55 : quality === "high" ? 1.6 : 1.0;
          const scaled = Math.max(1, Math.round(autoStepsBase * mult));
          const max = Math.max(1, settings.max_auto_steps ?? 6000);
          return Math.min(max, scaled);
        })()
      : null;
  const effectiveSteps = userStepsOverride ?? autoSteps ?? trainingConfig.training_steps;

  const nextStepHint = useMemo(() => {
    if (!selectedAsset) return "Select or create an asset to continue.";
    if (!selectedPresetId) return "Choose a preset in Prep or Assets to continue.";
    if (!captionsReady) return "Complete descriptions in Prep before creating.";
    if (props.isSetupPreview) return "Preview only until system setup is complete.";
    if (!engineReady) return "Follow the setup checklist above to continue.";
    if (!runDir) return "Prepare a run to lock in settings.";
    if (runNeedsRebuild) return "Settings changed since this run was prepared. Rebuild the run before training.";
    if (isTrainingRunActive) return "Training is running. You can keep working while it finishes.";
    if (trainingProgress.phase === "completed") return "Training finished. Your LoRA artifacts are ready.";
    if (trainingProgress.phase === "failed") return "Training failed. Check run details for the last log lines.";
    return "Ready to train.";
  }, [captionsReady, engineReady, isTrainingRunActive, props.isSetupPreview, runDir, runNeedsRebuild, selectedAsset, selectedPresetId, trainingProgress.phase]);

  async function createTrainingAsset() {
    if (!selectedProjectId) return;
    const folder = preferredFolderForTab(folders, assetTab);
    if (!folder) {
      setUi({ kind: "error", message: "Create the asset folders in Assets first, then return to Training." });
      return;
    }
    setUi({ kind: "working", message: "Creating asset..." });
    try {
      const tab = TRAINING_TABS.find((item) => item.id === assetTab)!;
      const created = await createAsset({
        projectId: selectedProjectId,
        folderId: folder.id,
        name: assetName,
        assetType: tab.assetTypes[0] ?? "custom",
        modelFamily: assetTab === "characters" ? "sdxl" : "flux",
      });
      setAssets((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedAssetId(created.id);
      setAssetName("");
      setCreateAssetOpen(false);
      setUi({ kind: "idle" });
    } catch (error) {
      setUi({ kind: "error", message: String(error) });
    }
  }

  async function prepareRun() {
    if (props.isSetupPreview) {
      setUi({ kind: "error", message: "Preview mode keeps run preparation disabled until system setup is complete." });
      return;
    }
    if (!selectedProjectId || !selectedAsset || !selectedPresetId || !assetPaths) return;
    if (!captionStatus?.ok) {
      setUi({ kind: "error", message: "Descriptions are not ready yet. Complete the asset Prep before training." });
      return;
    }

    setUi({ kind: "working", message: "Preparing run..." });
    try {
      const report = await runEngineCheck();
      if (!report?.ok) {
        setUi({ kind: "error", message: "System setup is not ready yet. Open Settings to fix it." });
        return;
      }

      const architectureOverride = (trainingConfig.model_architecture || "").trim();
      const engineKey = engineForAsset({ asset: selectedAsset, training: trainingConfig });
      const triggerWord = selectedAsset.trigger_tokens[0] ?? trainingConfig.trigger_word;
      const overrides = {
        training: {
          ...trainingConfig,
          training_steps: effectiveSteps,
          engine: engineKey || trainingConfig.engine,
          model_architecture: architectureOverride || selectedAsset.model_family,
          model_family: (architectureOverride || selectedAsset.model_family || "").trim() || selectedAsset.model_family,
          trigger_word: triggerWord,
          trigger_tokens: selectedAsset.trigger_tokens,
          model_name_or_path: effectiveBaseModelPath,
          optimizer_args: trainingConfig.optimizer_args
            .split(/\s+/)
            .map((x) => x.trim())
            .filter(Boolean),
          text_encoder_lr: [trainingConfig.text_encoder_lr, trainingConfig.text_encoder_lr],
          datasets: trainingConfig.datasets.map((dataset) => ({
            image_dir: dataset.image_dir || assetPaths.images_dir,
            num_repeats: dataset.num_repeats,
            is_reg: dataset.is_reg,
            class_tokens: dataset.class_tokens,
            lora_weight: dataset.lora_weight,
            default_caption: dataset.default_caption,
            caption_dropout_rate: dataset.caption_dropout_rate,
            cache_latents: dataset.cache_latents,
            flip_x: dataset.flip_x,
            flip_y: dataset.flip_y,
            resolutions: dataset.resolutions,
            num_frames: dataset.num_frames,
          })),
          sampling: {
            ...trainingConfig.sampling,
            prompts: trainingConfig.sampling.prompts
              .filter((prompt) => prompt.prompt.trim().length > 0)
              .map((prompt) => ({ ...prompt, prompt: ensureTriggerInPrompt(prompt.prompt, triggerWord) })),
          },
        },
      };

      const created = await createAssetRun({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        presetId: selectedPresetId,
        trainingOverrides: overrides,
      });
      setAutoOpenedRunDir(null);
      setRunDir(created.run_dir);
      setRunVersion(created.version);
      const runLabel = (trainingConfig.run_label || "").trim();
      if (runLabel) {
        await setRunLabel({ runDir: created.run_dir, label: runLabel });
      }
      setLogLines([]);
      setIsTrainingRunActive(false);
      setTrainingProgress(initialTrainingProgress());
      if (selectedAsset.model_family === "sdxl" || selectedAsset.model_family === "sd15") {
        await prepareTrainingPackage({ runDir: created.run_dir });
        const nextArtifacts = await runArtifactsStatus({ runDir: created.run_dir });
        setArtifacts(nextArtifacts);
      } else {
        setArtifacts(null);
      }
      clearRunNeedsRebuild();
      setUi({ kind: "idle" });
    } catch (error) {
      setUi({ kind: "error", message: String(error) });
    }
  }

  async function doTrain() {
    if (props.isSetupPreview) {
      setUi({ kind: "error", message: "Preview mode keeps training disabled until system setup is complete." });
      return;
    }
    if (!selectedAsset || !runDir) return;
    if (runNeedsRebuild) {
      setUi({ kind: "error", message: "Training settings changed since the run was prepared. Create or rebuild the run before training." });
      return;
    }
    if (!engineConfigured) {
      setUi({
        kind: "error",
        message: managedFluxRequired ? "Install or repair FLUX Schnell in Settings before training." : "System setup is required before training.",
      });
      return;
    }
    if (!captionStatus?.ok) {
      setUi({ kind: "error", message: "Descriptions are not ready yet. Complete the asset Prep first." });
      return;
    }

    setUi({ kind: "working", message: "Training in progress…" });
    setIsTrainingRunActive(true);
    setLogLines([]);
    setTrainingProgress(startTrainingProgress());
    try {
      await startTrainingWithEngine({ runDir, engineKey: engineForAsset({ asset: selectedAsset, training: trainingConfig }) });
    } catch (error) {
      setIsTrainingRunActive(false);
      setTrainingProgress((prev) => failTrainingProgress(prev));
      setUi({ kind: "error", message: String(error) });
    }
  }

  const stopTraining = useCallback(async () => {
    if (!runDir || cancelingRunId) return;
    setCancelingRunId(runDir);
    setUi({ kind: "working", message: "Stopping training…" });
    try {
      await cancelTraining({ runId: runDir });
    } catch (error) {
      setCancelingRunId(null);
      setUi({ kind: "error", message: String(error) });
    }
  }, [cancelingRunId, runDir]);

  const confirmDeleteRun = useCallback(async () => {
    if (!runDir) return;
    setDeleteRunLoading(true);
    setDeleteRunError(null);
    setUi({ kind: "working", message: "Deleting LoRA run…" });
    const result = await cleanupRun(runDir);
    setDeleteRunLoading(false);
    if (result.success) {
      setDeleteRunModalOpen(false);
      setUi({ kind: "idle" });
    } else {
      setDeleteRunError(result.error);
      setUi({ kind: "error", message: result.error });
    }
  }, [cleanupRun, runDir]);

  const trainingActionLabel = ui.kind === "working" ? (isTrainingRunActive ? formatProgressActionLabel(trainingProgress, ui.message) : ui.message) : "Train";
  const showProgressPanel = Boolean(runDir) || isTrainingRunActive || trainingProgress.phase !== "idle" || logLines.length > 0;

  return (
    <>
      <ConfettiBurst active={showConfetti} />
      <div className="space-y-4 font-sans">
      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--fc-text)]">Create</h2>
              <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
                Create now follows the same asset tabs as Prep, so characters, props, set deck, and lighting all live inside the same production flow.
              </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-xs">
            <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="training-kind">
              Asset type
            </label>
            <select
              id="training-kind"
              className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
              value={assetTab}
              onChange={(event) => setAssetTab(event.currentTarget.value as AssetTabId)}
              aria-label="Asset type"
            >
              {TRAINING_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:flex-1">
            <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="training-asset-search">
              Find an asset (optional)
            </label>
            <input
              id="training-asset-search"
              className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
              value={assetQuery}
              onChange={(event) => setAssetQuery(event.currentTarget.value)}
              placeholder="Search by asset name"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Selected asset</div>
            <div className="mt-2 flex gap-2">
              <select
                className="w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)]"
                value={selectedAssetId}
                onChange={(event) => setSelectedAssetId(event.currentTarget.value)}
                disabled={!filteredAssets.length}
              >
                {filteredAssets.length === 0 ? (
                  <option value="">{assetQuery.trim() ? "No assets match your search" : "No assets in this asset type yet"}</option>
                ) : null}
                {filteredAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                onClick={() => setCreateAssetOpen(true)}
              >
                Add
              </button>
            </div>
            <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
              {selectedAsset ? `${selectedAsset.dataset_image_count} images • ${selectedAsset.model_family}` : "Create the first asset in this tab to start training."}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Selected preset</div>
            <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{selectedPreset?.display_name ?? "None"}</div>
            <div className="mt-1 text-xs text-[var(--fc-text-muted)]">{selectedPreset?.description ?? "Choose a preset in Prep or Assets."}</div>
          </div>

          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Quality level</div>
                <div className="mt-1 text-sm text-[var(--fc-text-muted)]">Choose speed vs. fidelity. You can refine later with additional runs.</div>
              </div>
              <div className="flex gap-2">
                {(["fast", "standard", "high"] as Quality[]).map((q) => {
                  const active = quality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      className={[
                        "rounded-xl border px-3 py-2 text-sm font-semibold",
                        active
                          ? "border-[var(--fc-border-strong)] bg-[var(--fc-panel)] text-[var(--fc-text)]"
                          : "border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text)]",
                      ].join(" ")}
                      onClick={() => {
                        setQuality(q);
                        markRunNeedsRebuild();
                      }}
                      disabled={ui.kind === "working"}
                    >
                      {q === "fast" ? "Fast" : q === "high" ? "High" : "Standard"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Engine setup guidance already appears at the top-level app banner; avoid duplicating it here. */}

        {props.isSetupPreview ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text-muted)]">
            <span>Preview mode shows the real asset and preset state, but run prep and training stay off until setup is complete.</span>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={props.onOpenSettings}
            >
              Open Setup
            </button>
          </div>
        ) : null}

        {ui.kind === "error" ? (
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-danger)]">{ui.message}</div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!canPrepareRun}
            onClick={() => void prepareRun()}
          >
            {props.isSetupPreview ? "Prepare Run" : runDir ? "Rebuild Run" : "Prepare Run"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-4 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              disabled={!canTrain || !runDir || runNeedsRebuild}
              onClick={() => void doTrain()}
            >
              {props.isSetupPreview ? "Train" : trainingActionLabel}
            </button>
            {isTrainingRunActive ? (
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-danger)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={!runDir || Boolean(cancelingRunId)}
                onClick={() => void stopTraining()}
              >
                Stop training
              </button>
          ) : null}
        </div>
        {runNeedsRebuild && runDir ? (
          <div className="mt-2 text-sm text-[var(--fc-danger)]">
            Settings changed since this run was prepared. Prepare a new run before training.
          </div>
        ) : null}
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => updatePreferences({ showAdvancedTraining: !preferences.showAdvancedTraining })}
          >
            {preferences.showAdvancedTraining ? "Hide advanced" : "Advanced"}
          </button>
        </div>

        <div className="mt-4 text-sm text-[var(--fc-text-muted)]">{nextStepHint}</div>

        {artifacts?.primary_safetensors_path ? (
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Latest LoRA</div>
            <div className="mt-1 break-all text-sm text-[var(--fc-text)]">{artifacts.primary_safetensors_path}</div>
          </div>
        ) : null}
      </div>

      {preferences.showAdvancedTraining ? <AdvancedSettingsPanel value={trainingConfig} onChange={handleTrainingConfigChange} /> : null}

      {showProgressPanel ? (
        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="text-sm font-semibold text-[var(--fc-text)]">Progress</div>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Keep this simple while you work. Details are tucked away.</p>
          <TrainingProgressPanel
            progress={trainingProgress}
            active={isTrainingRunActive || trainingProgress.phase === "completed" || trainingProgress.phase === "failed"}
          />

          <details className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--fc-text)]">
              Run details
              <span className="ml-2 text-xs font-medium text-[var(--fc-text-muted)]">
                {runVersion ? `(${runVersion})` : ""}
              </span>
            </summary>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Caption status</div>
                <div className="mt-1 text-sm text-[var(--fc-text)]">
                  {captionStatus ? `Images ${captionStatus.image_count} • Descriptions ${captionStatus.caption_count}` : "Not checked yet"}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Run</div>
                <div className="mt-1 text-sm text-[var(--fc-text)]">{runVersion || "Not prepared yet"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                    disabled={!runDir}
                    onClick={() => void openRunDirectory(runDir)}
                  >
                    Open run folder
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Artifacts</div>
                <div className="mt-1 break-all text-sm text-[var(--fc-text)]">{artifacts?.primary_safetensors_path ?? "No trained model yet"}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                    disabled={!runDir || isTrainingRunActive || Boolean(cancelingRunId) || deleteRunLoading}
                    onClick={() => {
                      setDeleteRunError(null);
                      setDeleteRunModalOpen(true);
                    }}
                  >
                    Delete LoRA
                  </button>
                  <span className="text-xs text-[var(--fc-text-muted)]">
                    {runDir ? "Removes the current run and its LoRA artifacts." : "Prepare a run to delete it from the library."}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
              {runVersion ? <div className="text-xs text-[var(--fc-text-muted)]">Log: {runVersion}</div> : <div className="text-xs text-[var(--fc-text-muted)]">Log</div>}
              <pre className="mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--fc-text-muted)]">
                {logLines.length ? logLines.join("\n") : "Training output will appear here when you start a run."}
              </pre>
            </div>
          </details>
        </div>
      ) : null}
    </div>
    <Modal
      open={createAssetOpen}
      title={`Create ${TRAINING_TABS.find((tab) => tab.id === assetTab)?.label.slice(0, -1) || "asset"}`}
      description="Add a new training asset in this tab."
      onClose={() => setCreateAssetOpen(false)}
      footer={
        <>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => setCreateAssetOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            onClick={() => void createTrainingAsset()}
            disabled={!assetName.trim()}
          >
            Create
          </button>
        </>
      }
    >
      <div className="space-y-3 font-sans">
        <input
          className="w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
          value={assetName}
          onChange={(event) => setAssetName(event.currentTarget.value)}
          placeholder="Asset name"
        />
      </div>
    </Modal>
    <Modal
      open={deleteRunModalOpen}
      title="Delete LoRA run?"
      description="This removes the run folder and trained artifacts for the current asset."
      onClose={() => {
        if (deleteRunLoading) return;
        setDeleteRunModalOpen(false);
        setDeleteRunError(null);
      }}
      footer={
        <>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={deleteRunLoading}
            onClick={() => {
              setDeleteRunModalOpen(false);
              setDeleteRunError(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-danger)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            disabled={deleteRunLoading}
            onClick={() => void confirmDeleteRun()}
          >
            {deleteRunLoading ? "Deleting…" : "Delete LoRA"}
          </button>
        </>
      }
    >
      <div className="space-y-3 font-sans">
        <p className="text-sm text-[var(--fc-text-muted)]">
          Delete the run data for {selectedAsset?.name ?? "this asset"} ({runVersion || "untagged"}) to remove the LoRA and free up disk space. This
          cannot be undone.
        </p>
        {deleteRunError ? <p className="text-sm text-[var(--fc-danger)]">{deleteRunError}</p> : null}
      </div>
    </Modal>
    <Modal
      open={successModalOpen}
      title="Training complete!"
      description="Your LoRA run finished successfully."
      onClose={() => {
        setSuccessModalOpen(false);
        setShowConfetti(false);
      }}
      footer={
        <>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => {
              setSuccessModalOpen(false);
              setShowConfetti(false);
            }}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-success-border)] bg-[var(--fc-success)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
            onClick={() => {
              if (!successRunDir) return;
              void openRunDirectory(successRunDir);
            }}
          >
            Open run folder
          </button>
        </>
      }
    >
      <div className="space-y-3 font-sans">
        <div className="rounded-2xl border border-[var(--fc-success-border)] bg-[var(--fc-success-surface)] p-4 text-[var(--fc-success)]">
          <div className="text-lg font-semibold">Success!</div>
          <p className="text-sm text-[var(--fc-text)]">
            {selectedAsset?.name ?? "This asset"} finished training as {successRunVersion || runVersion || "the current run"}.
          </p>
        </div>
        <p className="text-sm text-[var(--fc-text-muted)]">Confetti celebrates the new LoRA. Open the folder to keep going.</p>
      </div>
    </Modal>
  </>
);
}
