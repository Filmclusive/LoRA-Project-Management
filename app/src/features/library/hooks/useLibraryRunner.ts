import { useEffect } from "react";
import {
  onRunnerLog,
  onRunnerStatus,
  listAssetModels,
  exportModel,
  type AssetModelSummary,
  type AssetSummary,
} from "@filmclusive/orchestrator";
import {
  completeTrainingProgress,
  failTrainingProgress,
  formatProgressActionLabel,
  startTrainingProgress,
  updateTrainingProgress,
} from "../../../lib/trainingProgress";

export function useLibraryRunner(
  activeRunId: string | null,
  selectedProjectId: string | null,
  selectedAsset: AssetSummary | null,
  pendingExport: any,
  refreshSelectedAsset: () => Promise<void>,
  // State setters
  setActiveRunId: (id: string | null) => void,
  setIsTrainingRunActive: (active: boolean) => void,
  setTrainingProgress: (fn: (prev: any) => any) => void,
  setRunningAction: (action: string) => void,
  setPendingExport: (val: any) => void,
  setStatus: (status: any) => void,
  safeRevealItem: (path: string, label: string) => Promise<void>,
) {
  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    void onRunnerStatus(async (event) => {
      if (!mounted) return;
      if (activeRunId && event.runId !== activeRunId) return;

      if (event.state === "started") {
        setActiveRunId(event.runId);
        setIsTrainingRunActive(true);
        const nextProgress = startTrainingProgress();
        setTrainingProgress(() => nextProgress);
        setRunningAction(formatProgressActionLabel(nextProgress, "Training in progress…"));
        return;
      }

      if (event.state === "completed") {
        if (activeRunId && event.runId !== activeRunId) return;
        const exportJob = pendingExport && pendingExport.runId === event.runId ? pendingExport : null;
        if (exportJob) setPendingExport(null);
        setTrainingProgress((prev) => completeTrainingProgress(prev));
        setIsTrainingRunActive(false);
        setRunningAction("");
        setActiveRunId(null);
        await refreshSelectedAsset();
        if (exportJob && selectedProjectId && selectedAsset) {
          try {
            const models = await listAssetModels({ projectId: selectedProjectId, assetId: selectedAsset.id });
            const match = models.find((model: AssetModelSummary) => model.run_dir === exportJob.runId);
            if (match) {
              const outputPath = await exportModel({
                projectId: selectedProjectId,
                assetId: selectedAsset.id,
                modelId: match.id,
                destinationRoot: exportJob.destinationRoot,
                destinationMode: "copy",
              });
              await safeRevealItem(outputPath, "Reveal export");
            }
          } catch (exportError) {
            setStatus({ kind: "error", message: `Export failed: ${String(exportError)}` });
          }
        }
        return;
      }

      if (event.state === "failed") {
        if (activeRunId && event.runId !== activeRunId) return;
        if (pendingExport && pendingExport.runId === event.runId) setPendingExport(null);
        setTrainingProgress((prev) => failTrainingProgress(prev));
        setIsTrainingRunActive(false);
        setRunningAction("");
        setActiveRunId(null);
        setStatus({ kind: "error", message: event.message });
        await refreshSelectedAsset();
      }
    })
      .then((dispose) => {
        if (!mounted) {
          void dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch(() => {});

    return () => {
      mounted = false;
      if (unlisten) void unlisten();
    };
  }, [activeRunId, pendingExport, refreshSelectedAsset, selectedAsset, selectedProjectId]);

  useEffect(() => {
    if (!activeRunId) return undefined;
    let unlistenLog: (() => void) | null = null;
    void onRunnerLog((event) => {
      if (event.runId !== activeRunId) return;
      setTrainingProgress((prev) => {
        const next = updateTrainingProgress(prev, event.line);
        setRunningAction(formatProgressActionLabel(next, "Training in progress…"));
        return next;
      });
    })
      .then((dispose) => {
        unlistenLog = dispose;
      })
      .catch(() => {});
    return () => {
      if (unlistenLog) void unlistenLog();
    };
  }, [activeRunId]);
}
