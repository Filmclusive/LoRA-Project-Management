import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { AppSettings } from "@filmclusive/orchestrator";

interface WeightsAndVaeSectionProps {
  settings: AppSettings;
  saveSettings: (s: AppSettings) => Promise<unknown>;
  statusKind: string;
  setupStatus: any;
  blipProgress: any;
  blipDownloadStatus: any;
  activeBlipDownloadId: string | null;
  cancelDownload: (id: string) => Promise<unknown>;
  setBlipInstallOpen: (v: boolean) => void;
  removeBlipWeights: () => Promise<unknown>;
}

export function WeightsAndVaeSection({
  settings,
  saveSettings,
  statusKind,
  setupStatus,
  blipProgress,
  blipDownloadStatus,
  activeBlipDownloadId,
  cancelDownload,
  setBlipInstallOpen,
  removeBlipWeights,
}: WeightsAndVaeSectionProps) {
  return (
    <>
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 md:col-span-2">
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">Description model weights (BLIP)</div>
        <div className="mt-1 break-words text-sm text-[var(--fc-text)]">
          {settings.blip_caption_weights_path?.trim() ? settings.blip_caption_weights_path : "Not set"}
        </div>
        <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
          Status:{" "}
          <span className="font-semibold text-[var(--fc-text)]">
            {!settings.blip_caption_weights_path?.trim()
              ? "Not set"
              : !setupStatus
                ? "Unknown"
                : setupStatus.blip_weights_ok
                  ? "Ready"
                  : "Not ready"}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            disabled={statusKind === "loading"}
            onClick={() => setBlipInstallOpen(true)}
          >
            Install
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!activeBlipDownloadId || statusKind === "loading"}
            onClick={() => (activeBlipDownloadId ? void cancelDownload(activeBlipDownloadId) : undefined)}
          >
            Pause
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={statusKind === "loading"}
            onClick={() => void removeBlipWeights()}
          >
            Remove
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              const selected = await openDialog({
                directory: false,
                multiple: false,
                title: "Select BLIP caption weights file",
              });
              if (!selected || Array.isArray(selected)) return;
              await saveSettings({ ...settings, blip_caption_weights_path: selected });
            }}
          >
            Choose file
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              await saveSettings({ ...settings, blip_caption_weights_path: "" });
            }}
          >
            Clear
          </button>
        </div>
        {blipProgress ? (
          <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--fc-text)]">
              <span>{blipProgress.fileName}</span>
              <span>{blipProgress.percent.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fc-panel)]">
              <div className="h-full bg-[var(--fc-accent)]" style={{ width: `${blipProgress.percent}%` }} />
            </div>
          </div>
        ) : null}
        {blipDownloadStatus ? (
          <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text-muted)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{blipDownloadStatus.message}</span>
              {blipDownloadStatus.state === "paused" ? (
                <button
                  type="button"
                  className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                  disabled={statusKind === "loading"}
                  onClick={() => setBlipInstallOpen(true)}
                >
                  Resume
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
          Install downloads <span className="font-semibold text-[var(--fc-text)]">model_large_caption.pth</span> automatically, or choose a local file.
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 md:col-span-2">
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">Optional SDXL VAE</div>
        <div className="mt-1 break-words text-sm text-[var(--fc-text)]">
          {settings.sdxl_vae_path?.trim() ? settings.sdxl_vae_path : "Not set"}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              const selected = await openDialog({
                directory: false,
                multiple: false,
                title: "Select VAE file",
              });
              if (!selected || Array.isArray(selected)) return;
              await saveSettings({ ...settings, sdxl_vae_path: selected });
            }}
          >
            Choose
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              await saveSettings({ ...settings, sdxl_vae_path: null });
            }}
          >
            Clear
          </button>
        </div>
        <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
          Leave this unset unless you know you need a specific VAE.
        </div>
      </div>
    </>
  );
}
