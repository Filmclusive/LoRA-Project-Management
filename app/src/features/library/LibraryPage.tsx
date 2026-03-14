import { deleteAssetImage } from "@filmclusive/orchestrator";
import { useEffect, useMemo, useState } from "react";
import { TrainingProgressPanel } from "../../components/TrainingProgressPanel";
import { useProjectContext } from "../../state/projectContext";
import { useSettingsContext } from "../../state/settingsContext";

// Modular Components
import { LibraryHeader } from "./components/LibraryHeader";
import { AssetsHelpModal } from "./components/AssetsHelpModal";
import { AssetList } from "./components/AssetList";
import { AssetWorkspace } from "./components/AssetWorkspace";
import { LibraryModals } from "./components/LibraryModals";

// Hooks
import { useLibrary } from "./hooks/useLibrary";

export function LibraryPage() {
  const { selectedProject, selectedProjectId } = useProjectContext();
  const { presets, selectedPresetId, setSelectedPresetId, settings } = useSettingsContext();

  const lib = useLibrary(
    selectedProjectId,
    presets,
    selectedPresetId,
    setSelectedPresetId,
    settings
  );

  if (!selectedProject) {
    return (
      <div className="font-sans">
        <h2 className="text-base font-semibold text-[var(--fc-text)]">Assets</h2>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Select a project to open its characters, props, wardrobe, sets, camera, and lighting assets.</p>
      </div>
    );
  }

  const helpStorageKey = useMemo(
    () => (selectedProjectId ? `fc_assets_help_dismissed_${selectedProjectId}` : null),
    [selectedProjectId],
  );
  const [assetsHelpOpen, setAssetsHelpOpen] = useState(false);

  useEffect(() => {
    if (!helpStorageKey) return;
    if (lib.status.kind === "loading") return;
    if (lib.assets.length > 0) return;
    if (window.localStorage.getItem(helpStorageKey) === "1") return;
    setAssetsHelpOpen(true);
  }, [helpStorageKey, lib.assets.length, lib.status.kind]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col font-sans">
      <LibraryHeader
        search={lib.search}
        setSearch={lib.setSearch}
        departmentFolders={lib.departmentFolders}
        selectedDepartmentId={lib.selectedDepartmentId}
        setSelectedDepartmentId={lib.setSelectedDepartmentId}
        departmentAssetCounts={lib.departmentAssetCounts}
        onOpenHelp={() => setAssetsHelpOpen(true)}
        onDepartmentChange={() => {
          lib.setWorkspaceTab("data");
          lib.setMobileAssetsOpen(true);
        }}
      />

      {lib.status.kind === "error" ? (
        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-danger)]">{lib.status.message}</div>
      ) : null}
      {lib.runningAction ? (
      <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-text-muted)]">{lib.runningAction}</div>
      ) : null}
      <TrainingProgressPanel
        progress={lib.trainingProgress}
        active={lib.isTrainingRunActive || lib.trainingProgress.phase === "completed" || lib.trainingProgress.phase === "failed"}
      />

      <div className="mt-4 grid min-h-0 min-w-0 grid-cols-12 gap-4">
        <AssetList
          visibleAssets={lib.visibleAssets}
          selectedAssetId={lib.selectedAssetId}
          setSelectedAssetId={lib.setSelectedAssetId}
          selectedAsset={lib.selectedAsset}
          selectedDepartmentId={lib.selectedDepartmentId}
          mobileAssetsOpen={lib.mobileAssetsOpen}
          setMobileAssetsOpen={lib.setMobileAssetsOpen}
          setWorkspaceTab={lib.setWorkspaceTab}
          setCreateAssetOpen={lib.setCreateAssetOpen}
          status={lib.status}
        />

        <AssetWorkspace
          selectedAsset={lib.selectedAsset}
          setImportModelOpen={lib.setImportModelOpen}
          activeRunId={lib.activeRunId}
          requestAssetDelete={lib.requestAssetDelete}
          deleteAssetStatus={lib.deleteAssetStatus}
          workspaceTab={lib.workspaceTab}
          setWorkspaceTab={lib.setWorkspaceTab}
          handleImportImages={lib.handleImportImages}
          handleGenerateDescriptions={lib.handleGenerateDescriptions}
          assetPaths={lib.assetPaths}
          safeOpenPath={lib.safeOpenPath}
          captionStatus={lib.captionStatus}
          selectedProjectId={selectedProjectId}
          refreshSelectedAsset={lib.refreshSelectedAsset}
          deleteAssetImage={deleteAssetImage}
          triggerTokensDraft={lib.triggerTokensDraft}
          setTriggerTokensDraft={lib.setTriggerTokensDraft}
          tagsDraft={lib.tagsDraft}
          setTagsDraft={lib.setTagsDraft}
          notesDraft={lib.notesDraft}
          setNotesDraft={lib.setNotesDraft}
          handleSaveMetadata={lib.handleSaveMetadata}
          savingMetadata={lib.savingMetadata}
          latestRunModel={lib.latestRunModel}
          artifactStatus={lib.artifactStatus}
          assetModels={lib.assetModels}
          handleExportModel={lib.handleExportModel}
          requestModelDelete={lib.requestModelDelete}
          setStatus={lib.setStatus}
        />
      </div>

      <AssetsHelpModal
        open={assetsHelpOpen}
        onClose={() => {
          setAssetsHelpOpen(false);
          if (helpStorageKey) window.localStorage.setItem(helpStorageKey, "1");
        }}
        onCreateAsset={() => {
          setAssetsHelpOpen(false);
          lib.setCreateAssetOpen(true);
        }}
      />

      <LibraryModals
        createAssetOpen={lib.createAssetOpen}
        setCreateAssetOpen={lib.setCreateAssetOpen}
        assetName={lib.assetName}
        setAssetName={lib.setAssetName}
        assetType={lib.assetType}
        setAssetType={lib.setAssetType}
        modelFamily={lib.modelFamily}
        setModelFamily={lib.setModelFamily}
        handleCreateAsset={lib.handleCreateAsset}
        importModelOpen={lib.importModelOpen}
        setImportModelOpen={lib.setImportModelOpen}
        pendingImportPath={lib.pendingImportPath}
        setPendingImportPath={lib.setPendingImportPath}
        importMode={lib.importMode}
        setImportMode={lib.setImportMode}
        handleImportLora={lib.handleImportLora}
        openDialog={lib.openDialog}
        deleteAssetIntent={lib.deleteAssetIntent}
        setDeleteAssetIntent={lib.setDeleteAssetIntent}
        deleteAssetStatus={lib.deleteAssetStatus}
        confirmAssetDelete={lib.confirmAssetDelete}
        deleteModelIntent={lib.deleteModelIntent}
        setDeleteModelIntent={lib.setDeleteModelIntent}
        deleteModelStatus={lib.deleteModelStatus}
        confirmModelDelete={lib.confirmModelDelete}
      />
    </div>
  );
}
