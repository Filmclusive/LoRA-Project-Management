import { useEffect, useMemo, useState } from "react";
import { runPreflight, type PreflightReport } from "@filmclusive/orchestrator";
import { useCharacterContext } from "../../../state/characterContext";
import { useSettingsContext } from "../../../state/settingsContext";
import { DatasetHealthPanel } from "../components/DatasetHealthPanel";

export function DatasetTab() {
  const { selectedCharacter, characterPaths, captionStatus } = useCharacterContext();
  const { selectedPresetId, selectedPreset } = useSettingsContext();
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [loading, setLoading] = useState(false);

  const canScan = useMemo(() => Boolean(characterPaths && selectedPresetId) && !loading, [characterPaths, selectedPresetId, loading]);

  useEffect(() => {
    setPreflight(null);
  }, [selectedCharacter?.id, selectedPresetId]);

  if (!selectedCharacter) return null;

  return (
    <div className="space-y-4">
      <DatasetHealthPanel imageCount={selectedCharacter.image_count} captionStatus={captionStatus} preset={selectedPreset} />

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fc-text)]">Dataset scan</div>
            <div className="mt-1 text-sm text-[var(--fc-text-muted)]">A quick, friendly scan to help you decide what to improve.</div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!canScan}
            onClick={async () => {
              if (!characterPaths || !selectedPresetId) return;
              setLoading(true);
              try {
                const report = await runPreflight({ datasetDir: characterPaths.images_dir, presetId: selectedPresetId });
                setPreflight(report);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Scanning…" : "Run scan"}
          </button>
        </div>

        {preflight ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Lighting variety</div>
              <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{preflight.signals.lighting_variation}</div>
            </div>
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Pose diversity</div>
              <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{preflight.signals.pose_diversity}</div>
            </div>
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Face visibility</div>
              <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{preflight.signals.face_visibility}</div>
            </div>

            {preflight.messages.length > 0 ? (
              <div className="md:col-span-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Notes</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
                  {preflight.messages.slice(0, 6).map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">
            Run a scan any time to get gentle feedback on dataset balance.
          </div>
        )}
      </div>
    </div>
  );
}
