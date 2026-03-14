import { useMemo } from "react";
import { useUserPreferences } from "../../state/userPreferences";
import { useSettingsContext } from "../../state/settingsContext";
import { useCharacterContext } from "../../state/characterContext";
import { OverviewTab } from "./tabs/OverviewTab";
import { ImagesTab } from "./tabs/ImagesTab";
import { DescriptionsTab } from "./tabs/DescriptionsTab";
import { DatasetTab } from "./tabs/DatasetTab";
import { PresetsTab } from "./tabs/PresetsTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "images", label: "Images" },
  { id: "descriptions", label: "Descriptions" },
  { id: "dataset", label: "Dataset" },
  { id: "presets", label: "Training presets" },
] as const;

export function CharacterWorkspace() {
  const { preferences, updatePreferences } = useUserPreferences();
  const { selectedPreset } = useSettingsContext();
  const { selectedCharacter } = useCharacterContext();

  const current = preferences.characterTab;
  const tab = useMemo(() => TABS.find((t) => t.id === current)?.id ?? "overview", [current]);

  if (!selectedCharacter) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col font-sans">
      <div className="shrink-0 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)]">
        <div className="border-b border-[var(--fc-border)] px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[var(--fc-text)]">{selectedCharacter.name}</div>
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                {selectedPreset ? `Preset: ${selectedPreset.display_name}` : "Choose a preset to guide your dataset and training."}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 px-3 py-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-[var(--fc-surface)] text-[var(--fc-text)]"
                    : "text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text)]",
                ].join(" ")}
                onClick={() => updatePreferences({ characterTab: t.id })}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-auto">
        {tab === "overview" ? <OverviewTab /> : null}
        {tab === "images" ? <ImagesTab /> : null}
        {tab === "descriptions" ? <DescriptionsTab /> : null}
        {tab === "dataset" ? <DatasetTab /> : null}
        {tab === "presets" ? <PresetsTab /> : null}
      </div>
    </div>
  );
}
