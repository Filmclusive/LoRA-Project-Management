import { Modal } from "../../../components/ui/Modal";
import { AssetSummary, AssetModelSummary } from "@filmclusive/orchestrator";
import { ASSET_TYPES, MODEL_FAMILIES, friendlyAssetType } from "./LibraryUtils";

interface LibraryModalsProps {
  createAssetOpen: boolean;
  setCreateAssetOpen: (open: boolean) => void;
  assetName: string;
  setAssetName: (val: string) => void;
  assetType: string;
  setAssetType: (val: string) => void;
  modelFamily: string;
  setModelFamily: (val: string) => void;
  handleCreateAsset: () => void;
  importModelOpen: boolean;
  setImportModelOpen: (open: boolean) => void;
  pendingImportPath: string;
  setPendingImportPath: (val: string) => void;
  importMode: "copy" | "link";
  setImportMode: (val: "copy" | "link") => void;
  handleImportLora: () => void;
  openDialog: (params: any) => Promise<string | string[] | null>;
  deleteAssetIntent: AssetSummary | null;
  setDeleteAssetIntent: (asset: AssetSummary | null) => void;
  deleteAssetStatus: { kind: string; message?: string };
  confirmAssetDelete: () => void;
  deleteModelIntent: AssetModelSummary | null;
  setDeleteModelIntent: (model: AssetModelSummary | null) => void;
  deleteModelStatus: { kind: string; message?: string };
  confirmModelDelete: () => void;
}

export function LibraryModals({
  createAssetOpen,
  setCreateAssetOpen,
  assetName,
  setAssetName,
  assetType,
  setAssetType,
  modelFamily,
  setModelFamily,
  handleCreateAsset,
  importModelOpen,
  setImportModelOpen,
  pendingImportPath,
  setPendingImportPath,
  importMode,
  setImportMode,
  handleImportLora,
  openDialog,
  deleteAssetIntent,
  setDeleteAssetIntent,
  deleteAssetStatus,
  confirmAssetDelete,
  deleteModelIntent,
  setDeleteModelIntent,
  deleteModelStatus,
  confirmModelDelete,
}: LibraryModalsProps) {
  return (
    <>
      <Modal
        open={createAssetOpen}
        title="Create asset"
        description="Create a new reusable asset in the current project."
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
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
              onClick={handleCreateAsset}
              disabled={!assetName.trim()}
            >
              Create asset
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)]"
              value={assetType}
              onChange={(event) => setAssetType(event.currentTarget.value)}
            >
              {ASSET_TYPES.map((value) => (
                <option key={value} value={value}>
                  {friendlyAssetType(value)}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)]"
              value={modelFamily}
              onChange={(event) => setModelFamily(event.currentTarget.value)}
            >
              {MODEL_FAMILIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={importModelOpen}
        title="Import LoRA"
        description="Attach an existing .safetensors LoRA to the selected asset."
        onClose={() => setImportModelOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={() => setImportModelOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
              onClick={handleImportLora}
              disabled={!pendingImportPath}
            >
              Import LoRA
            </button>
          </>
        }
      >
        <div className="space-y-3 font-sans">
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={async () => {
                const selected = await openDialog({ directory: false, multiple: false, title: "Select LoRA safetensors file" });
                if (!selected || Array.isArray(selected)) return;
                setPendingImportPath(selected);
              }}
            >
              Choose .safetensors
            </button>
            <select
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)]"
              value={importMode}
              onChange={(event) => setImportMode(event.currentTarget.value as "copy" | "link")}
            >
              <option value="copy">Copy into project</option>
              <option value="link">Reference only</option>
            </select>
          </div>
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text-muted)]">
            {pendingImportPath || "No file selected yet."}
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteAssetIntent !== null}
        size="md"
        title="Delete asset?"
        description={
          deleteAssetIntent ? `${deleteAssetIntent.name} • ${friendlyAssetType(deleteAssetIntent.asset_type)}` : undefined
        }
        onClose={() => (deleteAssetStatus.kind === "loading" ? null : setDeleteAssetIntent(null))}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => setDeleteAssetIntent(null)}
              disabled={deleteAssetStatus.kind === "loading"}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:opacity-60"
              onClick={confirmAssetDelete}
              disabled={deleteAssetStatus.kind === "loading"}
            >
              {deleteAssetStatus.kind === "loading" ? "Deleting asset…" : "Delete asset"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[var(--fc-text)]">
          <p>This removes the asset, its dataset, and any runs or LoRAs from disk.</p>
          <p>The action cannot be undone.</p>
          {deleteAssetStatus.kind === "error" ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
              {deleteAssetStatus.message}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={deleteModelIntent !== null}
        size="md"
        title="Delete run / LoRA?"
        description={
          deleteModelIntent ? `${deleteModelIntent.name} · ${deleteModelIntent.version}` : undefined
        }
        onClose={() => (deleteModelStatus.kind === "loading" ? null : setDeleteModelIntent(null))}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => setDeleteModelIntent(null)}
              disabled={deleteModelStatus.kind === "loading"}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:opacity-60"
              onClick={confirmModelDelete}
              disabled={deleteModelStatus.kind === "loading"}
            >
              {deleteModelStatus.kind === "loading" ? "Deleting…" : "Delete run"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[var(--fc-text)]">
          <p>This will permanently remove the selected run and its LoRA artifacts from disk.</p>
          {deleteModelStatus.kind === "error" ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
              {deleteModelStatus.message}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
