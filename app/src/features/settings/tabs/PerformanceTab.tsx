import { useMemo } from "react";
import { useSettingsContext } from "../../../state/settingsContext";

function formatDeviceSummary(report: NonNullable<ReturnType<typeof useSettingsContext>["engineReport"]>): string {
  const mode = report.torch.device_mode ?? "unknown";
  if (mode === "cuda") {
    const count = report.torch.cuda_device_count ?? report.torch.cuda_devices?.length ?? 0;
    return count ? `CUDA (${count} GPU${count === 1 ? "" : "s"})` : "CUDA";
  }
  if (mode === "mps") return "Apple Silicon (MPS)";
  if (mode === "cpu") return "CPU";
  return String(mode);
}

export function PerformanceTab() {
  const { status, settings, saveSettings, engineReport, runEngineCheck, platform, reload } = useSettingsContext();

  const precisionOptions = useMemo(() => ["fp16", "bf16", "no"] as const, []);
  const optimizerOptions = useMemo(() => ["AdamW", "AdamW8bit", "Prodigy"] as const, []);
  const linuxCudaOptions = useMemo(() => ["auto", "cu118", "cu121"] as const, []);

  if (!settings) {
    if (status.kind === "error") {
      return (
        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-sm font-semibold text-[var(--fc-text)]">Performance</div>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Settings could not be loaded.</p>
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-danger)]">
            {status.message}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={reload}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="text-sm text-[var(--fc-text-muted)]">
        {status.kind === "loading" ? status.message : "Loading performance settings…"}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
      <div className="text-sm font-semibold text-[var(--fc-text)]">Performance</div>
      <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
        Choose safe defaults for training. Most people can keep these as-is.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Detected device</div>
              <div className="mt-1 text-sm text-[var(--fc-text)]">
                {engineReport ? formatDeviceSummary(engineReport) : "Not checked yet"}
              </div>
              <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
                {engineReport ? `Python ${engineReport.python.version} • Torch ${engineReport.torch.version ?? "unknown"}` : "Run a check to confirm CUDA/MPS."}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={runEngineCheck}
              disabled={status.kind === "loading"}
            >
              Run check
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Mixed precision</div>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)]"
            value={settings.mixed_precision}
            onChange={async (e) => {
              const next = e.currentTarget.value;
              await saveSettings({ ...settings, mixed_precision: next });
            }}
          >
            {precisionOptions.map((p) => (
              <option key={p} value={p}>
                {p === "no" ? "No" : p.toUpperCase()}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
            FP16 is a good default. BF16 is useful on newer GPUs. Use No for maximum compatibility.
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Optimizer</div>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)]"
            value={settings.optimizer_type}
            onChange={async (e) => {
              await saveSettings({ ...settings, optimizer_type: e.currentTarget.value });
            }}
          >
            {optimizerOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
            AdamW8bit can reduce memory usage. If training fails, switch back to AdamW.
          </div>
        </div>

        {platform === "linux" ? (
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Linux CUDA runtime</div>
            <select
              className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)]"
              value={(settings.linux_cuda_variant || "auto") as string}
              onChange={async (e) => {
                await saveSettings({ ...settings, linux_cuda_variant: e.currentTarget.value });
              }}
            >
              {linuxCudaOptions.map((v) => (
                <option key={v} value={v}>
                  {v === "auto" ? "Auto" : v.toUpperCase()}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
              Auto chooses a compatible runtime based on your driver. Set this only if you know your CUDA version.
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Prevent sleep during training</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          Keep the computer awake while a training run is active so it never pauses or loses progress.
        </p>
        <label className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
          <input
            type="checkbox"
            checked={settings.prevent_sleep_during_training}
            onChange={async (event) => {
              await saveSettings({
                ...settings,
                prevent_sleep_during_training: event.currentTarget.checked,
              });
            }}
          />
          <span className="text-sm font-semibold text-[var(--fc-text)]">Prevent sleep while training runs are active</span>
        </label>
        <p className="mt-2 text-xs text-[var(--fc-text-muted)]">
          The app keeps a brief system assertion active throughout the run; the screensaver may still dim unless you override it in your OS settings.
        </p>
      </div>
    </div>
  );
}
