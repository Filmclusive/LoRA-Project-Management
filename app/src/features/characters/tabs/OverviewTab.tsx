import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useCharacterContext } from "../../../state/characterContext";
import { useSettingsContext } from "../../../state/settingsContext";
import { DatasetHealthPanel } from "../components/DatasetHealthPanel";

export function OverviewTab() {
  const { selectedCharacter, characterPaths, captionStatus, importFromPaths, generateDescriptions } = useCharacterContext();
  const { selectedPresetId, selectedPreset } = useSettingsContext();

  if (!selectedCharacter) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <DatasetHealthPanel imageCount={selectedCharacter.image_count} captionStatus={captionStatus} preset={selectedPreset} />
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Quick actions</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Keep moving in a simple, linear flow.</p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
            onClick={async () => {
              const selected = await openDialog({ directory: false, multiple: true, title: "Add images" });
              if (!selected) return;
              const paths = Array.isArray(selected) ? selected : [selected];
              await importFromPaths(paths);
            }}
          >
            Add images
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!selectedPresetId}
            onClick={async () => {
              await generateDescriptions(selectedPresetId);
            }}
          >
            Generate descriptions
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!characterPaths}
            onClick={async () => {
              if (!characterPaths) return;
              await openPath(characterPaths.images_dir);
            }}
          >
            Open images folder
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!characterPaths}
            onClick={async () => {
              if (!characterPaths) return;
              await openPath(characterPaths.dataset_dir);
            }}
          >
            Open dataset folder
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Notes</div>
          <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Import images, then generate descriptions. When the dataset is ready, training will unlock.
          </div>
        </div>
      </div>
    </div>
  );
}
