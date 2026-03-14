export type TrainingProgressPhase = "idle" | "setup" | "training" | "finalizing" | "completed" | "failed";

export type TrainingProgress = {
  phase: TrainingProgressPhase;
  phaseLabel: string;
  percent: number;
  currentStep: number | null;
  totalSteps: number | null;
  etaSeconds: number | null;
  elapsedSeconds: number;
  startedAtMs: number | null;
  trainingStartedAtMs: number | null;
  lastLine: string;
};

type SetupMarker = { pattern: RegExp; percent: number; label: string };

const SETUP_WEIGHT = 15;
const TRAINING_WEIGHT = 85;

const SETUP_MARKERS: SetupMarker[] = [
  { pattern: /loading settings/i, percent: 2, label: "Loading settings" },
  { pattern: /loading dataset config/i, percent: 4, label: "Loading dataset config" },
  { pattern: /prepare images/i, percent: 5, label: "Preparing images" },
  { pattern: /make buckets/i, percent: 6, label: "Bucketing images" },
  { pattern: /preparing accelerator/i, percent: 8, label: "Preparing accelerator" },
  { pattern: /loading model for process/i, percent: 9, label: "Loading model" },
  { pattern: /load stablediffusion.*checkpoint/i, percent: 10, label: "Loading base model" },
  { pattern: /loading u-net from.*checkpoint/i, percent: 11, label: "Loading U-Net" },
  { pattern: /loading text encoders from.*checkpoint/i, percent: 12, label: "Loading text encoders" },
  { pattern: /loading vae from.*checkpoint/i, percent: 13, label: "Loading VAE" },
  { pattern: /caching latents|caching text encoder outputs/i, percent: 14, label: "Caching training data" },
  { pattern: /create lora network|prepare optimizer, data loader etc/i, percent: 15, label: "Preparing optimizer" },
];

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseDurationToSeconds(value: string): number | null {
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => Number.isNaN(part) || part < 0)) return null;
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Math.round(minutes * 60 + seconds);
  }
  const [hours, minutes, seconds] = parts;
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

function withElapsed(progress: TrainingProgress, now: number): TrainingProgress {
  const elapsedSeconds = progress.startedAtMs ? Math.max(0, Math.round((now - progress.startedAtMs) / 1000)) : 0;
  return { ...progress, elapsedSeconds };
}

export function initialTrainingProgress(): TrainingProgress {
  return {
    phase: "idle",
    phaseLabel: "Waiting to start",
    percent: 0,
    currentStep: null,
    totalSteps: null,
    etaSeconds: null,
    elapsedSeconds: 0,
    startedAtMs: null,
    trainingStartedAtMs: null,
    lastLine: "",
  };
}

export function startTrainingProgress(now = Date.now()): TrainingProgress {
  return {
    ...initialTrainingProgress(),
    phase: "setup",
    phaseLabel: "Starting training",
    startedAtMs: now,
  };
}

export function completeTrainingProgress(progress: TrainingProgress, now = Date.now()): TrainingProgress {
  const next = {
    ...progress,
    phase: "completed" as const,
    phaseLabel: "Training complete",
    percent: 100,
    etaSeconds: 0,
  };
  return withElapsed(next, now);
}

export function failTrainingProgress(progress: TrainingProgress, now = Date.now()): TrainingProgress {
  const next = {
    ...progress,
    phase: "failed" as const,
    phaseLabel: "Training failed",
    etaSeconds: null,
  };
  return withElapsed(next, now);
}

export function formatDurationShort(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export function formatProgressActionLabel(progress: TrainingProgress, fallback = "Training..."): string {
  if (progress.phase === "training") return `Training ${progress.percent}%`;
  if (progress.phase === "setup") return progress.percent > 0 ? `Preparing ${progress.percent}%` : "Preparing...";
  if (progress.phase === "finalizing") return "Finalizing...";
  if (progress.phase === "completed") return "Training complete";
  if (progress.phase === "failed") return "Training failed";
  return fallback;
}

export function updateTrainingProgress(progress: TrainingProgress, line: string, now = Date.now()): TrainingProgress {
  const trimmed = line.trim();
  if (!trimmed) return withElapsed(progress, now);

  let next: TrainingProgress = withElapsed(
    {
      ...progress,
      startedAtMs: progress.startedAtMs ?? now,
      lastLine: trimmed,
    },
    now,
  );

  const totalStepsMatch = trimmed.match(/total optimization steps.*?:\s*(\d+)/i);
  if (totalStepsMatch) {
    const total = Number(totalStepsMatch[1]);
    if (Number.isFinite(total) && total > 0) {
      next.totalSteps = Math.max(next.totalSteps ?? 0, total);
    }
  }

  if (/running training/i.test(trimmed)) {
    next.phase = "training";
    next.phaseLabel = "Training";
    next.percent = Math.max(next.percent, SETUP_WEIGHT);
    if (!next.trainingStartedAtMs) next.trainingStartedAtMs = now;
  }

  const kohyaStepMatch = trimmed.match(/steps:\s*(\d{1,3})%\|[^|]*\|\s*(\d+)\s*\/\s*(\d+)\s*\[([0-9:]+)<([0-9:]+),/i);
  if (kohyaStepMatch) {
    const currentStep = Number(kohyaStepMatch[2]);
    const totalSteps = Number(kohyaStepMatch[3]);
    const etaFromBar = parseDurationToSeconds(kohyaStepMatch[5]);
    if (Number.isFinite(currentStep) && currentStep >= 0) next.currentStep = Math.max(next.currentStep ?? 0, currentStep);
    if (Number.isFinite(totalSteps) && totalSteps > 0) next.totalSteps = Math.max(next.totalSteps ?? 0, totalSteps);
    if (!next.trainingStartedAtMs) next.trainingStartedAtMs = now;
    next.phase = "training";
    next.phaseLabel = "Training";

    const resolvedCurrent = next.currentStep ?? 0;
    const resolvedTotal = next.totalSteps ?? 0;
    if (resolvedTotal > 0) {
      const fraction = Math.max(0, Math.min(1, resolvedCurrent / resolvedTotal));
      const weighted = SETUP_WEIGHT + fraction * TRAINING_WEIGHT;
      next.percent = Math.max(next.percent, clampPercent(Math.min(99, weighted)));
    } else {
      const rawPercent = Number(kohyaStepMatch[1]);
      if (Number.isFinite(rawPercent)) {
        const weighted = SETUP_WEIGHT + (Math.max(0, Math.min(100, rawPercent)) / 100) * TRAINING_WEIGHT;
        next.percent = Math.max(next.percent, clampPercent(Math.min(99, weighted)));
      }
    }

    if (etaFromBar != null) {
      next.etaSeconds = etaFromBar;
    } else if ((next.currentStep ?? 0) > 1 && (next.totalSteps ?? 0) > (next.currentStep ?? 0) && next.trainingStartedAtMs) {
      const elapsedTrainingSeconds = Math.max(1, Math.round((now - next.trainingStartedAtMs) / 1000));
      const stepsPerSecond = (next.currentStep as number) / elapsedTrainingSeconds;
      if (stepsPerSecond > 0) {
        next.etaSeconds = Math.round(((next.totalSteps as number) - (next.currentStep as number)) / stepsPerSecond);
      }
    }
    return withElapsed(next, now);
  }

  const mockMatch = trimmed.match(/Progress:\s*(\d{1,3})%/i);
  if (mockMatch) {
    const progressPercent = clampPercent(Number(mockMatch[1]));
    next.phase = progressPercent >= 100 ? "finalizing" : "training";
    next.phaseLabel = progressPercent >= 100 ? "Finalizing" : "Training";
    next.percent = Math.max(next.percent, progressPercent);
    if (next.startedAtMs && progressPercent > 0 && progressPercent < 100) {
      const elapsedSeconds = Math.max(1, Math.round((now - next.startedAtMs) / 1000));
      next.etaSeconds = Math.round((elapsedSeconds * (100 - progressPercent)) / progressPercent);
    }
    return withElapsed(next, now);
  }

  if (/saving|save model|save_state|save weighted/i.test(trimmed)) {
    next.phase = "finalizing";
    next.phaseLabel = "Saving model";
    next.percent = Math.max(next.percent, 99);
    next.etaSeconds = 30;
    return withElapsed(next, now);
  }

  if (/training complete/i.test(trimmed)) {
    return completeTrainingProgress(next, now);
  }

  if (next.phase !== "training" && next.phase !== "finalizing" && next.phase !== "completed") {
    for (const marker of SETUP_MARKERS) {
      if (marker.pattern.test(trimmed)) {
        next.phase = "setup";
        next.phaseLabel = marker.label;
        next.percent = Math.max(next.percent, marker.percent);
        break;
      }
    }
  }

  return withElapsed(next, now);
}
