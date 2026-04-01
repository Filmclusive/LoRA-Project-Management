import { AssetPaths, CaptionStatusReport } from "@filmclusive/orchestrator";
import { ImageGallery } from "../../characters/components/ImageGallery";

interface DataTabProps {
  handleImportImages: (mode: "copy" | "link") => void;
  handleImportFolder: (mode: "copy" | "link") => void;
  handleGenerateDescriptions: () => void;
  assetPaths: AssetPaths | null;
  safeOpenPath: (path: string, label: string) => void;
  captionStatus: CaptionStatusReport | null;
  selectedAssetId: string;
  selectedProjectId: string;
  selectedAssetUpdatedAt: string;
  refreshSelectedAsset: () => void;
  deleteAssetImage: (params: { projectId: string; assetId: string; fileName: string }) => Promise<any>;
}

export function DataTab({
  handleImportImages,
  handleImportFolder,
  handleGenerateDescriptions,
  assetPaths,
  safeOpenPath,
  captionStatus,
  selectedAssetId,
  selectedProjectId,
  selectedAssetUpdatedAt,
  refreshSelectedAsset,
  deleteAssetImage,
}: DataTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 [&::marker]:hidden [&::-webkit-details-marker]:hidden">
            Add images
          </summary>
          <div className="absolute left-0 top-full z-10 mt-2 w-56 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-2 shadow-2xl">
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={(event) => {
                (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                void handleImportImages("copy");
              }}
            >
              Copy into dataset
            </button>
            <button
              type="button"
              className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={(event) => {
                (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                void handleImportFolder("copy");
              }}
            >
              Copy folder into dataset
            </button>
            <button
              type="button"
              className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={(event) => {
                (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                void handleImportImages("link");
              }}
            >
              Link originals
            </button>
            <button
              type="button"
              className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={(event) => {
                (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                void handleImportFolder("link");
              }}
            >
              Link folder
            </button>
          </div>
        </details>
        <button
          type="button"
          className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
          disabled={!assetPaths}
          onClick={handleGenerateDescriptions}
        >
          Generate descriptions
        </button>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] [&::marker]:hidden [&::-webkit-details-marker]:hidden">
            More
          </summary>
          <div className="absolute left-0 top-full z-10 mt-2 w-56 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-2 shadow-2xl">
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              disabled={!assetPaths}
              onClick={(event) => {
                (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                if (!assetPaths) return;
                safeOpenPath(assetPaths.images_dir, "Open images folder");
              }}
            >
              Open images folder
            </button>
          </div>
        </details>
      </div>

      {captionStatus ? (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Descriptions</div>
          <div className="mt-1 text-sm text-[var(--fc-text)]">
            {captionStatus.ok ? "Ready for training." : "Missing descriptions."} Images {captionStatus.image_count} • Descriptions{" "}
            {captionStatus.caption_count} • Missing {captionStatus.missing_count}
          </div>
          {!captionStatus.ok ? (
            <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
              Generate descriptions, then review and edit captions directly in the gallery.
            </div>
          ) : null}
        </div>
      ) : null}

      {assetPaths ? (
        <ImageGallery
          imagesDir={assetPaths.images_dir}
          thumbsDir={assetPaths.thumbs_dir}
          originalsDir={assetPaths.originals_dir}
          refreshNonce={selectedAssetUpdatedAt}
          onCaptionsChanged={() => void refreshSelectedAsset()}
          onDeleteImage={(fileName) =>
            selectedProjectId && selectedAssetId
              ? deleteAssetImage({ projectId: selectedProjectId, assetId: selectedAssetId, fileName }).then(() => true)
              : Promise.resolve(false)
          }
        />
      ) : null}
    </div>
  );
}
