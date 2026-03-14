import type { CaptionStatusReport, PresetPublic } from "@filmclusive/orchestrator";

function badgeTone(kind: "good" | "warn" | "neutral") {
  if (kind === "good") return "border-[var(--fc-success-border)] bg-[var(--fc-success-surface)] text-[var(--fc-success)]";
  if (kind === "warn") return "border-[var(--fc-warning-border)] bg-[var(--fc-warning-surface)] text-[var(--fc-warning)]";
  return "border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-text-muted)]";
}

export function DatasetHealthPanel(props: {
  imageCount: number;
  captionStatus: CaptionStatusReport | null;
  preset: PresetPublic | null;
}) {
  const minImages = props.preset?.recommended_images.min ?? 0;
  const targetImages = props.preset?.recommended_images.target ?? 0;

  const descriptionsOk = Boolean(props.captionStatus?.ok);
  const hasImages = props.imageCount > 0;
  const hasEnoughImages = minImages ? props.imageCount >= minImages : hasImages;

  let readinessLabel = "Add images to begin";
  let readinessKind: "good" | "warn" | "neutral" = "neutral";
  if (!hasImages) {
    readinessLabel = "Add images to begin";
    readinessKind = "neutral";
  } else if (!descriptionsOk) {
    readinessLabel = "Add descriptions to continue";
    readinessKind = "warn";
  } else if (!hasEnoughImages) {
    readinessLabel = "Almost ready for training";
    readinessKind = "warn";
  } else {
    readinessLabel = "Ready for training";
    readinessKind = "good";
  }

  const coverage =
    props.captionStatus && props.captionStatus.image_count > 0
      ? Math.round((props.captionStatus.caption_count / props.captionStatus.image_count) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--fc-text)]">Dataset readiness</div>
          <div className="mt-1 text-sm text-[var(--fc-text-muted)]">A quick check before you train.</div>
        </div>
        <span className={["shrink-0 rounded-xl border px-3 py-1 text-xs font-semibold", badgeTone(readinessKind)].join(" ")}>
          {readinessLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Images</div>
          <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{props.imageCount}</div>
          {minImages ? (
            <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
              Suggested: {minImages}–{props.preset?.recommended_images.max ?? minImages} (target {targetImages})
            </div>
          ) : (
            <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Add a variety of angles, expressions, and lighting.</div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Descriptions</div>
          <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">
            {props.captionStatus ? `${coverage}% covered` : "Not checked yet"}
          </div>
          <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
            {descriptionsOk ? "Descriptions look complete." : hasImages ? "Generate descriptions to match your images." : "Add images first."}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Resolution consistency</div>
          <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{hasImages ? "Normalized" : "—"}</div>
          <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Images are prepared into a training-friendly format on import.</div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Readiness</div>
          <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{readinessLabel}</div>
          <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
            {!hasImages ? "Add images to unlock the rest of Prep." : !descriptionsOk ? "Generate descriptions, then create." : "You can train anytime."}
          </div>
        </div>
      </div>
    </div>
  );
}
