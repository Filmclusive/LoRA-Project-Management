import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  createAsset,
  createAssetRun,
  exportModel,
  generateCaptions,
  importAssetImagesWithMode,
  importLora,
  startTrainingWithEngine,
  updateAsset,
  prepareTrainingPackage,
  type AssetModelSummary,
  type AssetSummary,
} from "@filmclusive/orchestrator";
import { coerceTrainingConfig } from "../../../state/trainingConfig";
import { computeAutoTrainingSteps } from "../../../lib/autoSteps";
import { engineForAsset } from "../components/LibraryUtils";

export function useLibraryActions(
  selectedProjectId: string | null,
  selectedDepartmentId: string | null,
  selectedAsset: AssetSummary | null,
  selectedPresetId: string | null,
  settings: any,
  assetPaths: any,
  latestRunModel: AssetModelSummary | null,
  isNativeTraining: boolean,
  // State setters
  setStatus: any,
  setRunningAction: any,
  setAssetName: any,
  setCreateAssetOpen: any,
  setSelectedAssetId: any,
  setImportModelOpen: any,
  setPendingImportPath: any,
  setSavingMetadata: any,
  setSavingTrainingOverride: any,
  setWorkspaceTab: any,
  setPendingExport: any,
  setActiveRunId: any,
  reloadLibrary: any,
  refreshSelectedAsset: any,
  // Draft values
  assetName: string,
  assetType: string,
  modelFamily: string,
  importMode: "copy" | "link",
  pendingImportPath: string,
  triggerTokensDraft: string,
  tagsDraft: string,
  notesDraft: string,
  trainingStepsOverrideDraft: string,
) {
  async function handleCreateAsset() {
    if (!selectedProjectId) return;
    if (!selectedDepartmentId) return;
    setRunningAction("Creating asset…");
    try {
      const created = await createAsset({
        projectId: selectedProjectId,
        folderId: selectedDepartmentId,
        name: assetName,
        assetType,
        modelFamily,
      });
      setCreateAssetOpen(false);
      setAssetName("");
      setSelectedAssetId(created.id);
      await reloadLibrary();
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    } finally {
      setRunningAction("");
    }
  }

  async function handleImportImages(mode: "copy" | "link") {
    if (!selectedProjectId || !selectedAsset) return;
    const selection = await openDialog({ directory: false, multiple: true, title: "Add asset images" });
    if (!selection) return;
    const sourcePaths = Array.isArray(selection) ? selection : [selection];
    setRunningAction(mode === "link" ? "Linking originals…" : "Importing images…");
    try {
      await importAssetImagesWithMode({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        sourcePaths,
        mode,
      });
      await refreshSelectedAsset();
      await reloadLibrary();
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    } finally {
      setRunningAction("");
    }
  }

  async function handleImportFolder(mode: "copy" | "link") {
    if (!selectedProjectId || !selectedAsset) return;
    const selection = await openDialog({
      directory: true,
      multiple: true,
      title: mode === "link" ? "Link folder" : "Import folder",
    });
    if (!selection) return;
    const sourcePaths = Array.isArray(selection) ? selection : [selection];
    setRunningAction(mode === "link" ? "Linking originals…" : "Importing images…");
    try {
      await importAssetImagesWithMode({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        sourcePaths,
        mode,
      });
      await refreshSelectedAsset();
      await reloadLibrary();
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    } finally {
      setRunningAction("");
    }
  }

  async function handleImportLora() {
    if (!selectedProjectId || !selectedAsset || !pendingImportPath) return;
    setRunningAction("Importing LoRA…");
    try {
      await importLora({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        sourcePath: pendingImportPath,
        mode: importMode,
      });
      setImportModelOpen(false);
      setPendingImportPath("");
      await refreshSelectedAsset();
      await reloadLibrary();
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    } finally {
      setRunningAction("");
    }
  }

  async function handleSaveMetadata() {
    if (!selectedProjectId || !selectedAsset) return;
    setSavingMetadata(true);
    try {
      await updateAsset({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        tags: tagsDraft.split(",").map((item) => item.trim()).filter(Boolean),
        triggerTokens: triggerTokensDraft.split(",").map((item) => item.trim()).filter(Boolean),
        notes: notesDraft,
      });
      await reloadLibrary();
      await refreshSelectedAsset();
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    } finally {
      setSavingMetadata(false);
    }
  }

  async function handleGenerateDescriptions() {
    if (!assetPaths) return;
    if (!selectedPresetId?.trim()) return;
    const captionBackend = (settings?.caption_backend?.trim() ? settings.caption_backend : "sidecar").toLowerCase();
    const isBlipBackend = captionBackend === "blip";
    const blipWeightsReady = Boolean(settings?.blip_caption_weights_path?.trim());
    if (isBlipBackend && !blipWeightsReady) {
      setStatus({
        kind: "error",
        message: "BLIP weights are not configured. Open Settings > System and install/select BLIP weights, then retry.",
      });
      return;
    }
    setRunningAction("Generating descriptions…");
    try {
      await generateCaptions({ datasetDir: assetPaths.images_dir, presetId: selectedPresetId });
      await refreshSelectedAsset();
      setRunningAction("Descriptions generated.");
      window.setTimeout(() => setRunningAction(""), 1500);
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
      setRunningAction("");
    }
  }

  async function handleSaveTrainingOverride(nextValue?: string) {
    if (!selectedProjectId || !selectedAsset) return;
    const trimmed = (nextValue ?? trainingStepsOverrideDraft).trim();
    const parsed = trimmed ? Number(trimmed) : 0;
    if (trimmed && (!Number.isFinite(parsed) || parsed <= 0)) {
      setStatus({ kind: "error", message: "Training steps override must be a positive number." });
      return;
    }
    setSavingTrainingOverride(true);
    try {
      await updateAsset({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        trainingStepsOverride: parsed,
      });
      await refreshSelectedAsset();
      setRunningAction(trimmed ? "Training steps override saved." : "Training steps override cleared.");
      window.setTimeout(() => setRunningAction(""), 1500);
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    } finally {
      setSavingTrainingOverride(false);
    }
  }

  async function handleBuildRun() {
    if (!selectedProjectId || !selectedAsset || !selectedPresetId) return;
    setRunningAction("Building training package…");
    try {
      const userOverride =
        selectedAsset.training_steps_override && selectedAsset.training_steps_override > 0 ? selectedAsset.training_steps_override : null;
      const autoEnabled = Boolean(settings?.auto_steps_from_images);
      const canAuto = autoEnabled && Boolean(settings) && selectedAsset.dataset_image_count > 0;
      const autoSteps = canAuto && settings
        ? (() => {
            const cfg = coerceTrainingConfig(settings.training_defaults);
            const repeats = cfg.datasets[0]?.num_repeats ?? 1;
            return computeAutoTrainingSteps({
              imageCount: selectedAsset.dataset_image_count,
              repeats,
              stepsPerImage: settings.steps_per_image ?? 100,
              batchSize: cfg.batch_size ?? 1,
              gradAcc: cfg.gradient_accumulation_steps ?? 1,
              minSteps: settings.min_auto_steps ?? 100,
              maxSteps: settings.max_auto_steps ?? 6000,
            });
          })()
        : null;
      const effectiveSteps = userOverride ?? autoSteps ?? null;
      const trainingOverrides = effectiveSteps ? { training: { training_steps: effectiveSteps } } : undefined;
      const created = await createAssetRun({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        presetId: selectedPresetId,
        trainingOverrides,
      });
      await refreshSelectedAsset();
      setWorkspaceTab("models");
      setRunningAction(`Training package built: ${created.version}`);
      window.setTimeout(() => setRunningAction(""), 2500);
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
      setRunningAction("");
    }
  }

  async function handleTrain(options: { chooseDestination?: boolean } = {}) {
    if (!latestRunModel?.run_dir) return;

    const shouldAutoExport = Boolean(settings?.auto_export_after_training);
    const shouldPrompt = Boolean(options.chooseDestination || settings?.prompt_export_dir_on_train);
    let destinationRoot: string | undefined = undefined;

    if (shouldAutoExport && shouldPrompt) {
      const chosenRoot = await openDialog({ directory: true, multiple: false, title: "Choose LoRA save folder" });
      if (!chosenRoot || Array.isArray(chosenRoot)) return;
      destinationRoot = chosenRoot;
    }

    setRunningAction("Starting LoRA training…");
    try {
      if (shouldAutoExport) setPendingExport({ runId: latestRunModel.run_dir, destinationRoot });
      if (isNativeTraining) {
        await prepareTrainingPackage({ runDir: latestRunModel.run_dir });
      }
      await startTrainingWithEngine({ runDir: latestRunModel.run_dir, engineKey: engineForAsset(selectedAsset) });
      setActiveRunId(latestRunModel.run_dir);
      setRunningAction("Training in progress…");
    } catch (error) {
      setPendingExport(null);
      setStatus({ kind: "error", message: String(error) });
      setRunningAction("");
    }
  }

  async function handleExportModel(model: AssetModelSummary) {
    if (!selectedProjectId || !selectedAsset) return;
    setRunningAction("Exporting LoRA…");
    try {
      const needsDestination = !settings?.default_export_dir?.trim();
      let destinationRoot: string | undefined = undefined;
      if (needsDestination) {
        const chosenRoot = await openDialog({ directory: true, multiple: false, title: "Choose export folder" });
        if (!chosenRoot || Array.isArray(chosenRoot)) return;
        destinationRoot = chosenRoot;
      }
      await exportModel({
        projectId: selectedProjectId,
        assetId: selectedAsset.id,
        modelId: model.id,
        destinationRoot,
        destinationMode: "copy",
      });
      // safeRevealItem logic would go here, but we pass it as a prop or handle it in the hook
    } catch (error) {
      setStatus({ kind: "error", message: String(error) });
    } finally {
      setRunningAction("");
    }
  }

  return {
    handleCreateAsset,
    handleImportImages,
    handleImportFolder,
    handleImportLora,
    handleSaveMetadata,
    handleGenerateDescriptions,
    handleSaveTrainingOverride,
    handleBuildRun,
    handleTrain,
    handleExportModel,
  };
}
