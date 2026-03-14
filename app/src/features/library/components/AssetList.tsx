import { AssetSummary } from "@filmclusive/orchestrator";
import { friendlyAssetType, statusTone, formatWhen, LoadState } from "./LibraryUtils";

interface AssetListProps {
  visibleAssets: AssetSummary[];
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  selectedAsset: AssetSummary | null;
  selectedDepartmentId: string | null;
  mobileAssetsOpen: boolean;
  setMobileAssetsOpen: (open: boolean) => void;
  setWorkspaceTab: (tab: any) => void;
  setCreateAssetOpen: (open: boolean) => void;
  status: LoadState;
}

export function AssetList({
  visibleAssets,
  selectedAssetId,
  setSelectedAssetId,
  selectedAsset,
  selectedDepartmentId,
  mobileAssetsOpen,
  setMobileAssetsOpen,
  setWorkspaceTab,
  setCreateAssetOpen,
  status,
}: AssetListProps) {
  return (
    <section className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 lg:col-span-5">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--fc-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-[var(--fc-text)]">Assets</div>
            <span className="rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--fc-text-muted)]">
              {visibleAssets.length}
            </span>
          </div>
          <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
            {selectedDepartmentId ? "Choose an asset to open its photos, captions, runs, and LoRAs." : "Pick a department first."}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] lg:hidden"
            onClick={() => setMobileAssetsOpen(!mobileAssetsOpen)}
            aria-expanded={mobileAssetsOpen}
          >
            {mobileAssetsOpen ? "Hide list" : "Show list"}
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
            onClick={() => setCreateAssetOpen(true)}
            disabled={!selectedDepartmentId}
          >
            New asset
          </button>
        </div>
      </div>

      {!mobileAssetsOpen ? (
        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 lg:hidden">
          <div className="text-sm font-semibold text-[var(--fc-text)]">{selectedAsset ? selectedAsset.name : "No asset selected"}</div>
          <div className="mt-1 text-xs text-[var(--fc-text-muted)]">{visibleAssets.length} assets in view</div>
        </div>
      ) : null}

      <div
        className={[
          "mt-4 min-h-0 flex-1 space-y-3 overflow-auto pr-1",
          mobileAssetsOpen ? "block" : "hidden",
          "lg:block",
        ].join(" ")}
      >
        {visibleAssets.map((asset) => {
          const active = asset.id === selectedAssetId;
          return (
            <button
              key={asset.id}
              type="button"
              className={[
                "w-full rounded-2xl border p-4 text-left",
                active
                  ? "border-[var(--fc-border-strong)] bg-[var(--fc-surface)]"
                  : "border-[var(--fc-border)] bg-[var(--fc-panel)] hover:bg-[var(--fc-surface-hover)]",
              ].join(" ")}
              onClick={() => {
                setSelectedAssetId(asset.id);
                setWorkspaceTab("data");
                setMobileAssetsOpen(false);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--fc-text)]">{asset.name}</div>
                  <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
                    {friendlyAssetType(asset.asset_type)} • {asset.model_family}
                  </div>
                </div>
                <span className={`rounded-xl border px-2 py-1 text-xs font-semibold ${statusTone(asset.status)}`}>{asset.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--fc-text-muted)]">
                <span>{asset.dataset_image_count} images</span>
                <span>{asset.version_count} versions</span>
                <span>{asset.last_trained_at ? formatWhen(asset.last_trained_at) : "No trained version yet"}</span>
              </div>
            </button>
          );
        })}
        {status.kind === "loading" ? (
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">{status.message}</div>
        ) : null}
        {!visibleAssets.length && status.kind !== "loading" ? (
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">
            {selectedDepartmentId ? (
              <div className="space-y-3">
                <div>No assets yet in this department.</div>
                <button
                  type="button"
                  className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
                  onClick={() => setCreateAssetOpen(true)}
                >
                  Create your first asset
                </button>
              </div>
            ) : (
              "Choose a department to see its assets."
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
