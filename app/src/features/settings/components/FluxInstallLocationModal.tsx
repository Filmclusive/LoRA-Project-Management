import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Modal } from "../../../components/ui/Modal";

export function FluxInstallLocationModal(props: {
  open: boolean;
  modelLabel: string;
  currentModelDownloadRoot: string;
  onClose: () => void;
  onInstall: (args: { mode: "default" } | { mode: "current" } | { mode: "custom"; folder: string }) => Promise<void>;
}) {
  const hasCustomRoot = Boolean(props.currentModelDownloadRoot.trim());

  return (
    <Modal
      open={props.open}
      title={`Install ${props.modelLabel}`}
      description="Choose where the download should be stored. You can pause and resume later if needed."
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={props.onClose}
          >
            Cancel
          </button>
          {hasCustomRoot ? (
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={() => void props.onInstall({ mode: "current" })}
            >
              Use current
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => void props.onInstall({ mode: "default" })}
          >
            Use default
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
            onClick={async () => {
              const selected = await openDialog({ directory: true, multiple: false, title: "Select model download folder" });
              if (!selected || Array.isArray(selected)) return;
              await props.onInstall({ mode: "custom", folder: selected });
            }}
          >
            Choose folder
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Current location</div>
          <div className="mt-1 break-words text-sm text-[var(--fc-text)]">
            {hasCustomRoot ? props.currentModelDownloadRoot : "Default (Application Support)"}
          </div>
        </div>
        <p className="text-sm text-[var(--fc-text-muted)]">
          Default installs under Application Support. Choosing a folder updates the model download location used by managed models and caches.
        </p>
      </div>
    </Modal>
  );
}
