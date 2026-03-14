import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useCharacterContext } from "../../../state/characterContext";
import { ImageGallery } from "../components/ImageGallery";

export function ImagesTab() {
  const { selectedCharacter, characterPaths, lastImport, importFromPaths, refreshCaptionStatus, deleteImage } = useCharacterContext();

  if (!selectedCharacter) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-[var(--fc-text)]">Images</h3>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          Add photos that represent the character from different angles, expressions, and lighting.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
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
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              const selected = await openDialog({ directory: true, multiple: false, title: "Add folder" });
              if (!selected || Array.isArray(selected)) return;
              await importFromPaths([selected]);
            }}
          >
            Add folder
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
            Open prepared images
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!characterPaths}
            onClick={async () => {
              if (!characterPaths) return;
              await openPath(characterPaths.originals_dir);
            }}
          >
            Open originals
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Current count</div>
          <div className="mt-1 text-sm font-semibold text-[var(--fc-text)]">{selectedCharacter.image_count} images</div>
        </div>

        {lastImport ? (
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Last import</div>
            <div className="mt-1 text-sm text-[var(--fc-text)]">
              Imported {lastImport.imported} • Converted {lastImport.converted} • Skipped {lastImport.skipped_duplicates} • Failed{" "}
              {lastImport.failed}
            </div>
            {lastImport.failures.length > 0 ? (
              <div className="mt-2 text-xs text-[var(--fc-text-muted)]">{lastImport.failures[0]!.reason}</div>
            ) : null}
          </div>
        ) : null}

        {characterPaths ? (
          <ImageGallery
            imagesDir={characterPaths.images_dir}
            thumbsDir={characterPaths.thumbs_dir}
            originalsDir={characterPaths.originals_dir}
            refreshNonce={selectedCharacter.image_count}
            onCaptionsChanged={() => void refreshCaptionStatus()}
            onDeleteImage={deleteImage}
          />
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">
            Choose a character to see the image gallery.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Tips</div>
        <ul className="mt-3 space-y-2 text-sm text-[var(--fc-text-muted)]">
          <li>Use a consistent character and wardrobe if possible.</li>
          <li>Mix close-ups and full body shots.</li>
          <li>Include different lighting and backgrounds for versatility.</li>
        </ul>
      </div>
    </div>
  );
}
