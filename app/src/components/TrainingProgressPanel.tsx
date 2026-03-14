import { formatDurationShort, type TrainingProgress } from "../lib/trainingProgress";

export function TrainingProgressPanel(props: { progress: TrainingProgress; active: boolean }) {
  if (!props.active && props.progress.phase === "idle") return null;

  const percent = Math.max(0, Math.min(100, props.progress.percent));
  const currentStep = props.progress.currentStep;
  const totalSteps = props.progress.totalSteps;
  const remainingSteps = currentStep != null && totalSteps != null ? Math.max(0, totalSteps - currentStep) : null;
  const eta = props.progress.etaSeconds != null ? formatDurationShort(props.progress.etaSeconds) : null;
  const elapsed = props.progress.elapsedSeconds > 0 ? formatDurationShort(props.progress.elapsedSeconds) : null;

  return (
    <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--fc-text)]">{props.progress.phaseLabel}</div>
        <div className="text-sm font-semibold text-[var(--fc-text)]">{percent}%</div>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fc-panel)]"
        role="progressbar"
        aria-label="Training progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full rounded-full bg-[var(--fc-accent)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--fc-text-muted)]">
        {currentStep != null && totalSteps != null ? <span>Step {currentStep.toLocaleString()} / {totalSteps.toLocaleString()}</span> : null}
        {remainingSteps != null ? <span>{remainingSteps.toLocaleString()} steps left</span> : null}
        {eta ? <span>ETA {eta}</span> : null}
        {elapsed ? <span>Elapsed {elapsed}</span> : null}
      </div>
    </div>
  );
}
