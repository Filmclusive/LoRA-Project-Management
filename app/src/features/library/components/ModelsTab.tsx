import { AssetModelSummary, RunArtifactsStatus, setRunLabel } from "@filmclusive/orchestrator";
import { formatWhen, statusTone } from "./LibraryUtils";

interface ModelsTabProps {
  setImportModelOpen: (open: boolean) => void;
  latestRunModel: AssetModelSummary | null;
  artifactStatus: RunArtifactsStatus | null;
  assetModels: AssetModelSummary[];
  safeOpenPath: (path: string, label: string) => void;
  handleExportModel: (model: AssetModelSummary) => void;
  requestModelDelete: (model: AssetModelSummary) => void;
  refreshSelectedAsset: () => void;
  setStatus: (status: any) => void;
}

export function ModelsTab({
  setImportModelOpen,
  latestRunModel,
  artifactStatus,
  assetModels,
  safeOpenPath,
  handleExportModel,
  requestModelDelete,
  refreshSelectedAsset,
  setStatus,
}: ModelsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
          onClick={() => setImportModelOpen(true)}
        >
          Import LoRA
        </button>
      </div>
      {latestRunModel?.run_dir ? (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Latest training package</div>
          <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{latestRunModel.version}</div>
          <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
            {artifactStatus?.primary_safetensors_path ? "Primary LoRA artifact found." : "Build or train to generate LoRA artifacts."}
          </div>
        </div>
      ) : null}
      {assetModels.map((model) => (
        <div key={model.id} className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--fc-text)]">{model.name}</div>
              <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
                {model.version} • {model.engine_key} • {formatWhen(model.trained_at)}
              </div>
            </div>
            <span className={`rounded-xl border px-2 py-1 text-xs font-semibold ${statusTone(model.status)}`}>{model.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {model.run_dir ? (
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                onClick={() => void safeOpenPath(model.run_dir!, "Open training folder")}
              >
                Open training folder
              </button>
            ) : null}
            {model.run_dir ? (
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                onClick={async () => {
                  const next = window.prompt("Training label", model.name)?.trim() ?? "";
                  if (!next) return;
                  try {
                    await setRunLabel({ runDir: model.run_dir!, label: next });
                    await refreshSelectedAsset();
                  } catch (error) {
                    setStatus({ kind: "error", message: String(error) });
                  }
                }}
              >
                Rename
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => void handleExportModel(model)}
              disabled={model.artifacts.length === 0}
            >
              Export LoRA
            </button>
            {model.run_dir ? (
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                onClick={() => requestModelDelete(model)}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {!assetModels.length ? (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">
          No imported or trained LoRAs yet.
        </div>
      ) : null}
    </div>
  );
}
