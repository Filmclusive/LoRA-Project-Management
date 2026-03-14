import { useEffect, useMemo, useRef, useState } from "react";
import { getSystemStatus, onRunnerLog, onRunnerStatus, openPathInFinder, type SystemStatusReport } from "@filmclusive/orchestrator";
import { TrainingProgressPanel } from "../../../components/TrainingProgressPanel";
import {
  completeTrainingProgress,
  failTrainingProgress,
  formatDurationShort,
  formatProgressActionLabel,
  initialTrainingProgress,
  startTrainingProgress,
  updateTrainingProgress,
  type TrainingProgress,
} from "../../../lib/trainingProgress";
import { useSettingsContext } from "../../../state/settingsContext";
import { coerceTrainingConfig, type TrainingConfig } from "../../../state/trainingConfig";

type GpuProfile = "balanced" | "nomad";

type TrainingDefaultsPatch = Omit<Partial<TrainingConfig>, "sampling"> & { sampling?: Partial<TrainingConfig["sampling"]> };

const NOMAD_PROFILE_PATCH: TrainingDefaultsPatch = {
  mixed_precision: "bf16",
  sdpa: true,
  xformers: false,
  gradient_checkpointing: false,
  cache_latents: true,
  cache_text_encoder_outputs: true,
  max_data_loader_n_workers: 8,
  persistent_data_loader_workers: true,
  sampling: {
    disable_sampling: true,
    sample_every_n_steps: 0,
    sample_every_n_epochs: 0,
    sample_at_first: false,
  },
};

const BALANCED_PROFILE_PATCH: TrainingDefaultsPatch = {
  mixed_precision: "fp16",
  sdpa: false,
  xformers: true,
  gradient_checkpointing: true,
  cache_latents: true,
  cache_text_encoder_outputs: true,
  max_data_loader_n_workers: 2,
  persistent_data_loader_workers: false,
  sampling: {
    disable_sampling: false,
    sample_every_n_steps: 250,
    sample_every_n_epochs: 0,
    sample_at_first: false,
  },
};

function formatMiB(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Unknown";
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GiB`;
  return `${Math.round(value)} MiB`;
}

function deviceSummary(dev: NonNullable<SystemStatusReport["gpu"]>["devices"][number]) {
  const name = dev.name?.trim() || `GPU ${dev.index}`;
  const mem = dev.totalMemoryMiB != null ? ` • ${formatMiB(dev.totalMemoryMiB)}` : "";
  const cc =
    dev.computeCapabilityMajor != null && dev.computeCapabilityMinor != null ? ` • sm_${dev.computeCapabilityMajor}${dev.computeCapabilityMinor}` : "";
  return `${name}${mem}${cc}`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeNomadGpu(report: SystemStatusReport | null) {
  const name = normalizeName(report?.gpu?.devices?.[0]?.name ?? "");
  return name.includes("rtx 6000") && name.includes("blackwell");
}

function applyTrainingDefaultsPatch(base: Record<string, unknown> | null | undefined, patch: TrainingDefaultsPatch, profile: GpuProfile) {
  const current = (base && typeof base === "object" ? base : {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current, filmclusive_gpu_profile: profile };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "sampling" && value && typeof value === "object") {
      const existingSampling = (current.sampling && typeof current.sampling === "object" ? current.sampling : {}) as Record<string, unknown>;
      next.sampling = { ...existingSampling, ...(value as Record<string, unknown>) };
      continue;
    }
    next[key] = value as unknown;
  }
  return next;
}

export function GPUTab() {
  const { status, settings, saveSettings, reload } = useSettingsContext();
  const [systemStatus, setSystemStatus] = useState<SystemStatusReport | null>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const [isTrainingRunActive, setIsTrainingRunActive] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>(() => initialTrainingProgress());
  const [lastUpdateMs, setLastUpdateMs] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    getSystemStatus()
      .then((report) => {
        if (!mounted) return;
        setSystemStatus(report);
      })
      .catch(() => {
        if (!mounted) return;
        setSystemStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let unlistenLog: null | (() => void) = null;
    let unlistenStatus: null | (() => void) = null;
    let mounted = true;

    (async () => {
      const l = await onRunnerLog((event) => {
        if (!mounted) return;
        const active = activeRunIdRef.current;
        if (active && event.runId !== active) return;
        if (!activeRunIdRef.current) {
          activeRunIdRef.current = event.runId;
          setActiveRunId(event.runId);
        }
        setTrainingProgress((prev) => updateTrainingProgress(prev, event.line));
        setLastUpdateMs(Date.now());
      });
      const s = await onRunnerStatus((event) => {
        if (!mounted) return;
        const active = activeRunIdRef.current;
        if (active && event.runId !== active) return;

        if (event.state === "started") {
          activeRunIdRef.current = event.runId;
          setActiveRunId(event.runId);
          setIsTrainingRunActive(true);
          setTrainingProgress((prev) => {
            if (prev.startedAtMs && prev.phase !== "idle") return prev;
            return startTrainingProgress();
          });
          setLastUpdateMs(Date.now());
          return;
        }

        if (event.state === "completed") {
          setIsTrainingRunActive(false);
          setTrainingProgress((prev) => completeTrainingProgress(prev));
          activeRunIdRef.current = null;
          setActiveRunId(null);
          setLastUpdateMs(Date.now());
          return;
        }

        if (event.state === "failed") {
          setIsTrainingRunActive(false);
          setTrainingProgress((prev) => failTrainingProgress(prev));
          activeRunIdRef.current = null;
          setActiveRunId(null);
          setLastUpdateMs(Date.now());
        }
      });

      unlistenLog = () => l();
      unlistenStatus = () => s();
    })().catch(() => {});

    return () => {
      mounted = false;
      unlistenLog?.();
      unlistenStatus?.();
    };
  }, []);

  const gpuReport = systemStatus?.gpu ?? null;
  const devices = gpuReport?.devices ?? [];
  const hasCuda = Boolean(gpuReport?.cuda_available);
  const torchVersion = gpuReport?.torch_version ?? null;
  const torchCudaVersion = gpuReport?.torchCudaVersion ?? null;
  const isNomadGpu = looksLikeNomadGpu(systemStatus);

  const effectiveTrainingDefaults = useMemo(() => {
    if (!settings) return null;
    return coerceTrainingConfig(settings.training_defaults);
  }, [settings]);

  const currentProfile = (settings?.training_defaults && typeof settings.training_defaults === "object" ? (settings.training_defaults as Record<string, unknown>) : null)
    ?.filmclusive_gpu_profile;
  const profile: GpuProfile = currentProfile === "nomad" ? "nomad" : "balanced";
  const fullOptimizeEnabled = profile === "nomad";

  if (!settings) {
    if (status.kind === "error") {
      return (
        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 font-sans">
          <div className="text-sm font-semibold text-[var(--fc-text)]">GPU</div>
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
    return <div className="text-sm text-[var(--fc-text-muted)]">{status.kind === "loading" ? status.message : "Loading GPU settings…"}</div>;
  }

  const trainingStatusLabel =
    isTrainingRunActive && trainingProgress.phase !== "idle"
      ? formatProgressActionLabel(trainingProgress, "Training in progress…")
      : activeRunId
        ? "Training activity detected"
        : "No training run detected";

  const profileTitle = fullOptimizeEnabled ? "Nomad Platforms profile" : "Balanced profile";

  return (
    <div className="space-y-4 font-sans">
      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fc-text)]">GPU</div>
            <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
              Review what your system sees and apply a speed-focused training profile.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={status.kind === "loading"}
            onClick={async () => {
              try {
                const refreshed = await getSystemStatus();
                setSystemStatus(refreshed);
              } catch {
                setSystemStatus(null);
              }
            }}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Detected device</div>
            <div className="mt-1 text-sm text-[var(--fc-text)]">
              {gpuReport ? (hasCuda ? `${gpuReport.device_count} GPU${gpuReport.device_count === 1 ? "" : "s"} (CUDA)` : "CUDA not available") : "Not checked"}
            </div>
            <div className="mt-2 space-y-1 text-xs text-[var(--fc-text-muted)]">
              <div>
                Torch: <span className="font-semibold text-[var(--fc-text)]">{torchVersion ?? "Unknown"}</span>
                {torchCudaVersion ? (
                  <>
                    {" "}
                    (CUDA <span className="font-semibold text-[var(--fc-text)]">{torchCudaVersion}</span>)
                  </>
                ) : null}
              </div>
              {devices.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {devices.slice(0, 4).map((dev) => (
                    <li key={dev.index}>{deviceSummary(dev)}</li>
                  ))}
                </ul>
              ) : (
                <div>Run a system check to populate device details.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Training activity</div>
            <div className="mt-1 text-sm text-[var(--fc-text)]">{trainingStatusLabel}</div>
            <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
              {lastUpdateMs ? `Last update ${formatDurationShort(Math.round((Date.now() - lastUpdateMs) / 1000))} ago` : "No live runner events yet."}
            </div>
            {activeRunId ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[var(--fc-accent)] px-2 py-1 text-xs font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
                  onClick={() => void openPathInFinder({ path: activeRunId })}
                >
                  Open run folder
                </button>
                <div className="text-xs text-[var(--fc-text-muted)] break-all">{activeRunId}</div>
              </div>
            ) : null}

            <TrainingProgressPanel progress={trainingProgress} active={isTrainingRunActive} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fc-text)]">Optimized for Nomad Platforms</div>
            <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
              This profile targets fast workstation GPUs such as the Nvidia RTX 6000 Blackwell workstation edition used by{" "}
              <a href="https://nomadplatforms.com" target="_blank" rel="noreferrer" className="font-semibold text-[var(--fc-text)] underline underline-offset-2">
                Nomad Platforms
              </a>
              .
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2">
            <input
              type="checkbox"
              checked={fullOptimizeEnabled}
              onChange={async (event) => {
                const nextProfile: GpuProfile = event.currentTarget.checked ? "nomad" : "balanced";
                const nextPatch = nextProfile === "nomad" ? NOMAD_PROFILE_PATCH : BALANCED_PROFILE_PATCH;
                const nextTrainingDefaults = applyTrainingDefaultsPatch(settings.training_defaults, nextPatch, nextProfile);
                const nextMixedPrecision = nextPatch.mixed_precision ?? settings.mixed_precision;
                await saveSettings({
                  ...settings,
                  mixed_precision: typeof nextMixedPrecision === "string" ? nextMixedPrecision : settings.mixed_precision,
                  training_defaults: nextTrainingDefaults,
                });
              }}
            />
            <span className="text-sm font-semibold text-[var(--fc-text)]">Full optimize</span>
          </label>
        </div>

        {hasCuda && !isNomadGpu ? (
          <div className="mt-3 rounded-xl border border-[var(--fc-warning-border)] bg-[var(--fc-warning-surface)] p-3 text-xs text-[var(--fc-warning)]">
            This system does not look like an RTX 6000 Blackwell. Full optimize can still help, but it may raise VRAM use. If you hit out-of-memory errors, switch back to the balanced profile.
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Profile</div>
            <div className="mt-1 text-sm text-[var(--fc-text)]">{profileTitle}</div>
            <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
              Applies SDPA, disables gradient checkpointing, increases data loader workers, and disables sampling to keep the GPU busy.
            </div>
          </div>

          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">What will be used for new runs</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--fc-text-muted)]">
              <div>Precision</div>
              <div className="font-semibold text-[var(--fc-text)]">{effectiveTrainingDefaults?.mixed_precision ?? settings.mixed_precision}</div>
              <div>Attention</div>
              <div className="font-semibold text-[var(--fc-text)]">
                {effectiveTrainingDefaults ? (effectiveTrainingDefaults.sdpa ? "SDPA" : effectiveTrainingDefaults.xformers ? "xformers" : "torch") : "Unknown"}
              </div>
              <div>Checkpointing</div>
              <div className="font-semibold text-[var(--fc-text)]">{effectiveTrainingDefaults?.gradient_checkpointing ? "On" : "Off"}</div>
              <div>Data loader workers</div>
              <div className="font-semibold text-[var(--fc-text)]">{effectiveTrainingDefaults?.max_data_loader_n_workers ?? 2}</div>
              <div>Persistent workers</div>
              <div className="font-semibold text-[var(--fc-text)]">{effectiveTrainingDefaults?.persistent_data_loader_workers ? "On" : "Off"}</div>
              <div>Sampling</div>
              <div className="font-semibold text-[var(--fc-text)]">{effectiveTrainingDefaults?.sampling?.disable_sampling ? "Off" : "On"}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="text-sm font-semibold text-[var(--fc-text)]">How to go faster</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
            <li>Keep GPU utilization high by increasing data loader workers and using SDPA.</li>
            <li>On big GPUs, disabling gradient checkpointing usually speeds up training.</li>
            <li>Disable sampling during training if you want maximum throughput.</li>
            <li>If the GPU stays underutilized, your dataset storage or CPU may be the bottleneck.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
