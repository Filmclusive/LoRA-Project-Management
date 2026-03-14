import { useCharacterContext } from "../../../state/characterContext";
import { useSettingsContext } from "../../../state/settingsContext";
import { ImageGallery } from "../components/ImageGallery";

export function DescriptionsTab() {
  const { captionStatus, selectedCharacter, generateDescriptions, refreshCaptionStatus, characterPaths, deleteImage } = useCharacterContext();
  const { selectedPresetId } = useSettingsContext();

  if (!selectedCharacter) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-[var(--fc-text)]">Descriptions</h3>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          Descriptions help training understand what’s in each image, without you needing to think about technical details.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            disabled={!selectedPresetId || selectedCharacter.image_count === 0}
            onClick={async () => {
              if (!selectedPresetId) return;
              await generateDescriptions(selectedPresetId);
            }}
          >
            Generate descriptions
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              await refreshCaptionStatus();
            }}
          >
            Refresh status
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Status</div>
          <div className="mt-1 text-sm text-[var(--fc-text)]">
            {captionStatus ? (
              <>
                {captionStatus.ok ? "Ready for training." : "Needs attention."} Images {captionStatus.image_count} • Descriptions{" "}
                {captionStatus.caption_count} • Missing {captionStatus.missing_count}
              </>
            ) : (
              "Not checked yet."
            )}
          </div>
          {captionStatus?.messages?.length ? (
            <div className="mt-2 text-sm text-[var(--fc-text-muted)]">{captionStatus.messages[0]}</div>
          ) : null}
        </div>

        {characterPaths ? (
          <ImageGallery
            imagesDir={characterPaths.images_dir}
            thumbsDir={characterPaths.thumbs_dir}
            originalsDir={characterPaths.originals_dir}
            defaultFilter="missing"
            refreshNonce={captionStatus?.missing_count ?? 0}
            onCaptionsChanged={() => void refreshCaptionStatus()}
            onDeleteImage={deleteImage}
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">What “ready” means</div>
        <p className="mt-2 text-sm text-[var(--fc-text-muted)]">
          When every image has a description, training can start with fewer surprises.
        </p>
      </div>
    </div>
  );
}
