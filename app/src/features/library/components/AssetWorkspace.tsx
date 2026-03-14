import {
  AssetSummary,
  AssetPaths,
  AssetModelSummary,
  RunArtifactsStatus,
} from "@filmclusive/orchestrator";
import { friendlyAssetType, WorkspaceTab } from "./LibraryUtils";
import { DataTab } from "./DataTab";
import { CaptionsTab } from "./CaptionsTab";
import { ModelsTab } from "./ModelsTab";
import { UsageTab } from "./UsageTab";

interface AssetWorkspaceProps {
  selectedAsset: AssetSummary | null;
  setImportModelOpen: (open: boolean) => void;
  activeRunId: string | null;
  requestAssetDelete: () => void;
  deleteAssetStatus: { kind: string; message?: string };
  workspaceTab: WorkspaceTab;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  // Tab Props
  handleImportImages: (mode: "copy" | "link") => void;
  handleGenerateDescriptions: () => void;
  assetPaths: AssetPaths | null;
  safeOpenPath: (path: string, label: string) => void;
  captionStatus: any;
  selectedProjectId: string | null;
  refreshSelectedAsset: () => void;
  deleteAssetImage: (params: any) => Promise<any>;
  triggerTokensDraft: string;
  setTriggerTokensDraft: (val: string) => void;
  tagsDraft: string;
  setTagsDraft: (val: string) => void;
  notesDraft: string;
  setNotesDraft: (val: string) => void;
  handleSaveMetadata: () => void;
  savingMetadata: boolean;
  latestRunModel: AssetModelSummary | null;
  artifactStatus: RunArtifactsStatus | null;
  assetModels: AssetModelSummary[];
  handleExportModel: (model: AssetModelSummary) => void;
  requestModelDelete: (model: AssetModelSummary) => void;
  setStatus: (status: any) => void;
}

export function AssetWorkspace({
  selectedAsset,
  setImportModelOpen,
  activeRunId,
  requestAssetDelete,
  deleteAssetStatus,
  workspaceTab,
  setWorkspaceTab,
  handleImportImages,
  handleGenerateDescriptions,
  assetPaths,
  safeOpenPath,
  captionStatus,
  selectedProjectId,
  refreshSelectedAsset,
  deleteAssetImage,
  triggerTokensDraft,
  setTriggerTokensDraft,
  tagsDraft,
  setTagsDraft,
  notesDraft,
  setNotesDraft,
  handleSaveMetadata,
  savingMetadata,
  latestRunModel,
  artifactStatus,
  assetModels,
  handleExportModel,
  requestModelDelete,
  setStatus,
}: AssetWorkspaceProps) {
  if (!selectedAsset) {
    return (
      <section className="col-span-12 min-h-0 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 lg:col-span-7">
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--fc-border)] bg-[var(--fc-surface)] p-6 text-sm text-[var(--fc-text-muted)]">
          Select an asset to open its workspace.
        </div>
      </section>
    );
  }

  const tabLabel: Record<WorkspaceTab, string> = {
    data: "Images",
    captions: "Metadata",
    models: "LoRAs",
    usage: "Usage",
  };

  return (
    <section className="col-span-12 min-h-0 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 lg:col-span-7">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--fc-border)] pb-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-[var(--fc-text)]">{selectedAsset.name}</div>
            <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
              {friendlyAssetType(selectedAsset.asset_type)} • {selectedAsset.model_family}
            </div>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] [&::marker]:hidden [&::-webkit-details-marker]:hidden">
              More
            </summary>
            <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-2 shadow-2xl">
              <button
                type="button"
                className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:opacity-60"
                onClick={(event) => {
                  (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                  requestAssetDelete();
                }}
                disabled={Boolean(activeRunId) || deleteAssetStatus.kind === "loading"}
              >
                Delete asset
              </button>
            </div>
          </details>
        </div>

        <div className="mt-3 flex flex-wrap gap-1 border-b border-[var(--fc-border)] pb-3">
          {(["data", "captions", "models", "usage"] as WorkspaceTab[]).map((tabId) => (
            <button
              key={tabId}
              type="button"
              className={[
                "rounded-xl px-3 py-2 text-sm font-medium",
                workspaceTab === tabId
                  ? "bg-[var(--fc-surface)] text-[var(--fc-text)]"
                  : "text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text)]",
              ].join(" ")}
              onClick={() => setWorkspaceTab(tabId)}
            >
              {tabLabel[tabId]}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
          {workspaceTab === "data" && (
            <DataTab
              handleImportImages={handleImportImages}
              handleGenerateDescriptions={handleGenerateDescriptions}
              assetPaths={assetPaths}
              safeOpenPath={safeOpenPath}
              captionStatus={captionStatus}
              selectedAssetId={selectedAsset.id}
              selectedProjectId={selectedProjectId!}
              selectedAssetUpdatedAt={selectedAsset.updated_at}
              refreshSelectedAsset={refreshSelectedAsset}
              deleteAssetImage={deleteAssetImage}
            />
          )}
          {workspaceTab === "captions" && (
            <CaptionsTab
              triggerTokensDraft={triggerTokensDraft}
              setTriggerTokensDraft={setTriggerTokensDraft}
              tagsDraft={tagsDraft}
              setTagsDraft={setTagsDraft}
              notesDraft={notesDraft}
              setNotesDraft={setNotesDraft}
              handleSaveMetadata={handleSaveMetadata}
              savingMetadata={savingMetadata}
            />
          )}
          {workspaceTab === "models" && (
            <ModelsTab
              setImportModelOpen={setImportModelOpen}
              latestRunModel={latestRunModel}
              artifactStatus={artifactStatus}
              assetModels={assetModels}
              safeOpenPath={safeOpenPath}
              handleExportModel={handleExportModel}
              requestModelDelete={requestModelDelete}
              refreshSelectedAsset={refreshSelectedAsset}
              setStatus={setStatus}
            />
          )}
          {workspaceTab === "usage" && (
            <UsageTab
              selectedAsset={selectedAsset}
              notesDraft={notesDraft}
              setNotesDraft={setNotesDraft}
              handleSaveMetadata={handleSaveMetadata}
              savingMetadata={savingMetadata}
            />
          )}
        </div>
      </div>
    </section>
  );
}
