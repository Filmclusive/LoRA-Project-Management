import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { getStorageReport, getSystemStatus, type StorageReport, type SystemStatusReport } from "@filmclusive/orchestrator";
import { useSettingsContext } from "../../../state/settingsContext";

type UiState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let n = bytes;
  let idx = 0;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx += 1;
  }
  const fixed = idx === 0 ? 0 : idx <= 2 ? 1 : 2;
  return `${n.toFixed(fixed)} ${units[idx]}`;
}

export function StorageTab() {
  const { settings, saveSettings } = useSettingsContext();
  const [ui, setUi] = useState<UiState>({ kind: "loading" });
  const [report, setReport] = useState<StorageReport | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusReport | null>(null);

  const summary = useMemo(() => {
    if (!report) return null;
    const projectLabel = report.counts.projects === 1 ? "project" : "projects";
    const characterLabel = report.counts.characters === 1 ? "character" : "characters";
    return `${report.counts.projects} ${projectLabel} • ${report.counts.characters} ${characterLabel}`;
  }, [report]);

  useEffect(() => {
    let mounted = true;
    setUi({ kind: "loading" });
    Promise.all([getStorageReport(), getSystemStatus().catch(() => null)])
      .then(([r, sys]) => {
        if (!mounted) return;
        setReport(r);
        setSystemStatus(sys);
        setUi({ kind: "ready" });
      })
      .catch((e) => mounted && setUi({ kind: "error", message: String(e) }));
    return () => {
      mounted = false;
    };
  }, []);

  const resolvedLoraExportRoot = useMemo(() => {
    const configured = settings?.default_export_dir?.trim();
    if (configured) return configured;
    return systemStatus?.config?.models_lora_root ?? "";
  }, [settings?.default_export_dir, systemStatus?.config?.models_lora_root]);

  return (
    <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
      <div className="text-sm font-semibold text-[var(--fc-text)]">Storage</div>
      <p className="mt-1 text-sm text-[var(--fc-text-muted)]">See where your projects, datasets, and runs are stored.</p>

      {ui.kind === "loading" ? (
        <div className="mt-4 text-sm text-[var(--fc-text-muted)]">Loading storage details…</div>
      ) : null}

      {ui.kind === "error" ? (
        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-danger)]">
          {ui.message}
        </div>
      ) : null}

      {ui.kind === "ready" && report ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Data folder</div>
                <div className="mt-1 break-words text-sm text-[var(--fc-text)]">{report.root}</div>
                <div className="mt-1 text-xs text-[var(--fc-text-muted)]">{summary}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
                  onClick={async () => openPath(report.root)}
                >
                  Open folder
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Disk usage (scanned)</div>
              <div className="mt-1 text-sm text-[var(--fc-text)]">{formatBytes(report.stats_root.bytes)}</div>
              <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
                {formatBytes(report.stats_projects.bytes)} in projects • {report.stats_root.file_count.toLocaleString()} files
                {report.stats_root.truncated ? " (scan limited)" : ""}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Files</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                  onClick={async () => openPath(report.settings_path)}
                >
                  Open settings.json
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                  onClick={async () => openPath(report.library_path)}
                >
                  Open library.json
                </button>
              </div>
              <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
                These files track your local studio state. Avoid editing them while the app is running.
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">LoRA save folder</div>
            <div className="mt-1 break-words text-sm text-[var(--fc-text)]">
              {resolvedLoraExportRoot || "Not available"}
            </div>
            <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
              Trained LoRAs are also kept in each project’s run folders. Exports are organized by project and asset folders.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                disabled={!settings}
                onClick={async () => {
                  if (!settings) return;
                  const selected = await openDialog({ directory: true, multiple: false, title: "Select LoRA save folder" });
                  if (!selected || Array.isArray(selected)) return;
                  await saveSettings({ ...settings, default_export_dir: selected });
                }}
              >
                Choose folder
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={!settings?.default_export_dir}
                onClick={async () => {
                  if (!settings) return;
                  await saveSettings({ ...settings, default_export_dir: "" });
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={!resolvedLoraExportRoot}
                onClick={async () => {
                  if (!resolvedLoraExportRoot) return;
                  await openPath(resolvedLoraExportRoot);
                }}
              >
                Open folder
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Training exports</div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-[var(--fc-text)]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(settings?.auto_export_after_training)}
                  disabled={!settings}
                  onChange={async (event) => {
                    if (!settings) return;
                    await saveSettings({ ...settings, auto_export_after_training: event.currentTarget.checked });
                  }}
                />
                Automatically save trained LoRAs to the LoRA save folder
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--fc-text)]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(settings?.prompt_export_dir_on_train)}
                  disabled={!settings}
                  onChange={async (event) => {
                    if (!settings) return;
                    await saveSettings({ ...settings, prompt_export_dir_on_train: event.currentTarget.checked });
                  }}
                />
                Ask for a save folder each time you train
              </label>
            </div>
            <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
              If “Ask for a save folder” is enabled, the chosen folder is used only for that training run.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
