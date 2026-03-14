import { useSettingsContext } from "../../../state/settingsContext";

export function PresetsTab() {
  const { presets, selectedPresetId, setSelectedPresetId } = useSettingsContext();

  return (
    <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 font-sans">
      <h3 className="text-sm font-semibold text-[var(--fc-text)]">Training presets</h3>
      <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
        Presets guide recommendations for images and training. You can change this any time.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {presets.map((p) => {
          const active = p.id === selectedPresetId;
          return (
            <button
              key={p.id}
              type="button"
              className={[
                "rounded-2xl border p-4 text-left transition",
                active
                  ? "border-[var(--fc-border-strong)] bg-[var(--fc-surface)]"
                  : "border-[var(--fc-border)] bg-[var(--fc-panel)] hover:bg-[var(--fc-surface-hover)]",
              ].join(" ")}
              onClick={() => setSelectedPresetId(p.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--fc-text)]">{p.display_name}</div>
                  <div className="mt-1 text-sm text-[var(--fc-text-muted)]">{p.description}</div>
                  <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
                    Suggested images: {p.recommended_images.min}–{p.recommended_images.max} (target {p.recommended_images.target})
                  </div>
                </div>
                {active ? (
                  <span className="rounded-xl border border-[var(--fc-border-strong)] bg-[var(--fc-surface)] px-2 py-1 text-xs font-semibold text-[var(--fc-text)]">
                    Selected
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
