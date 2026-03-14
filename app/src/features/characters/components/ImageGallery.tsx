import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDatasetImages,
  readCaption,
  readImageCategories,
  setImageCategory,
  writeCaption,
  type DatasetImageEntry,
} from "@filmclusive/orchestrator";
import { Modal } from "../../../components/ui/Modal";

type ImageCategoryId =
  | ""
  | "close_portrait"
  | "full_body"
  | "wardrobe"
  | "prop"
  | "era"
  | "lighting";

const IMAGE_CATEGORIES: Array<{ id: Exclude<ImageCategoryId, "">; label: string }> = [
  { id: "close_portrait", label: "Close portrait" },
  { id: "full_body", label: "Full body" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "prop", label: "Prop" },
  { id: "era", label: "Era" },
  { id: "lighting", label: "Lighting" },
];

function srcForImage(entry: DatasetImageEntry) {
  return convertFileSrc(entry.thumb_path ?? entry.image_path);
}

function sortGalleryImages(images: DatasetImageEntry[]) {
  return [...images].sort((a, b) => {
    return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" });
  });
}

function compactLabel(text: string, max = 48) {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function ImageGallery(props: {
  imagesDir: string;
  thumbsDir?: string | null;
  originalsDir?: string | null;
  defaultFilter?: "all" | "missing";
  refreshNonce?: string | number;
  onCaptionsChanged?: () => void;
  onDeleteImage?: (fileName: string) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }>({
    kind: "idle",
  });
  const [images, setImages] = useState<DatasetImageEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "missing">(props.defaultFilter ?? "all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "uncategorized" | Exclude<ImageCategoryId, "">>("all");
  const [categoriesByFileName, setCategoriesByFileName] = useState<Record<string, string>>({});
  const [categoryStatus, setCategoryStatus] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : images[selectedIndex] ?? null;

  const [captionStatus, setCaptionStatus] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [captionOriginal, setCaptionOriginal] = useState<string>("");
  const [captionDraft, setCaptionDraft] = useState<string>("");

  const [deleteIntent, setDeleteIntent] = useState<
    | null
    | { kind: "single"; fileName: string; displayName: string }
    | { kind: "bulk"; fileNames: string[] }
  >(null);
  const [deleteStatus, setDeleteStatus] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }>({
    kind: "idle",
  });

  const refresh = useCallback(async () => {
    setStatus({ kind: "loading" });
    try {
      const [next, categories] = await Promise.all([
        listDatasetImages({
          datasetDir: props.imagesDir,
          thumbsDir: props.thumbsDir ?? null,
          originalsDir: props.originalsDir ?? null,
        }),
        readImageCategories({ datasetDir: props.imagesDir }).catch(() => ({})),
      ]);
      setImages(sortGalleryImages(next));
      setCategoriesByFileName(categories);
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  }, [props.imagesDir, props.originalsDir, props.thumbsDir]);

  useEffect(() => {
    void refresh();
  }, [refresh, props.refreshNonce]);

  const visible = useMemo(() => {
    const base = filter === "missing" ? images.filter((i) => !i.has_caption) : images;
    if (categoryFilter === "all") return base;
    if (categoryFilter === "uncategorized") return base.filter((i) => !(categoriesByFileName[i.file_name] ?? "").trim());
    return base.filter((i) => (categoriesByFileName[i.file_name] ?? "").trim() === categoryFilter);
  }, [categoryFilter, categoriesByFileName, filter, images]);

  const sections = useMemo(() => {
    const needsDescription = visible.filter((i) => !i.has_caption);
    const described = visible.filter((i) => i.has_caption);
    return { needsDescription, described };
  }, [visible]);

  const openByFileName = useCallback(
    (fileName: string) => {
      const idx = images.findIndex((i) => i.file_name === fileName);
      if (idx >= 0) setSelectedIndex(idx);
    },
    [images],
  );

  useEffect(() => {
    if (!selected) return;
    setCaptionStatus({ kind: "loading" });
    readCaption({ datasetDir: props.imagesDir, fileName: selected.file_name })
      .then((c) => {
        setCaptionOriginal(c);
        setCaptionDraft(c);
        setCaptionStatus({ kind: "idle" });
      })
      .catch((e) => setCaptionStatus({ kind: "error", message: String(e) }));
  }, [props.imagesDir, selected?.file_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = captionDraft.trim() !== captionOriginal.trim();

  const requestSingleDelete = useCallback(
    (entry: DatasetImageEntry) => {
      setDeleteStatus({ kind: "idle" });
      setDeleteIntent({ kind: "single", fileName: entry.file_name, displayName: entry.display_name });
    },
    [],
  );

  const requestBulkDelete = useCallback(() => {
    setDeleteStatus({ kind: "idle" });
    setDeleteIntent({ kind: "bulk", fileNames: images.map((img) => img.file_name) });
  }, [images]);

  const confirmDelete = useCallback(async () => {
    if (!deleteIntent || !props.onDeleteImage) return;
    setDeleteStatus({ kind: "loading" });
    try {
      if (deleteIntent.kind === "single") {
        const did = await props.onDeleteImage(deleteIntent.fileName);
        if (!did) {
          setDeleteStatus({ kind: "idle" });
          setDeleteIntent(null);
          return;
        }
      } else {
        for (const fileName of deleteIntent.fileNames) {
          const did = await props.onDeleteImage(fileName);
          if (!did) {
            throw new Error("Failed to delete one or more images.");
          }
        }
      }
      setDeleteStatus({ kind: "idle" });
      setDeleteIntent(null);
      setSelectedIndex(null);
      await refresh();
      props.onCaptionsChanged?.();
    } catch (e) {
      setDeleteStatus({ kind: "error", message: String(e) });
    }
  }, [deleteIntent, props, refresh]);

  const save = useCallback(async () => {
    if (!selected) return;
    setCaptionStatus({ kind: "loading" });
    try {
      const hasCaption = await writeCaption({
        datasetDir: props.imagesDir,
        fileName: selected.file_name,
        caption: captionDraft,
      });
      setImages((prev) =>
        sortGalleryImages(
          prev.map((img) => (img.file_name === selected.file_name ? { ...img, has_caption: hasCaption } : img)),
        ),
      );
      setCaptionOriginal(captionDraft);
      setCaptionStatus({ kind: "idle" });
      props.onCaptionsChanged?.();
    } catch (e) {
      setCaptionStatus({ kind: "error", message: String(e) });
    }
  }, [captionDraft, props, selected]);

  const remove = useCallback(async () => {
    if (!selected) return;
    requestSingleDelete(selected);
  }, [requestSingleDelete, selected]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (selectedIndex === null) return;
      const next = selectedIndex + dir;
      if (next < 0 || next >= images.length) return;
      setSelectedIndex(next);
    },
    [images.length, selectedIndex],
  );

  const selectedCategory = selected ? ((categoriesByFileName[selected.file_name] ?? "").trim() as ImageCategoryId) : "";

  const updateSelectedCategory = useCallback(
    async (next: ImageCategoryId) => {
      if (!selected) return;
      setCategoryStatus({ kind: "loading" });
      try {
        await setImageCategory({
          datasetDir: props.imagesDir,
          fileName: selected.file_name,
          category: next || null,
        });
        setCategoriesByFileName((prev) => {
          const copy = { ...prev };
          if (!next) delete copy[selected.file_name];
          else copy[selected.file_name] = next;
          return copy;
        });
        setCategoryStatus({ kind: "idle" });
      } catch (e) {
        setCategoryStatus({ kind: "error", message: String(e) });
      }
    },
    [props.imagesDir, selected],
  );

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Gallery</div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="gallery-filter">
            Show
          </label>
          <select
            id="gallery-filter"
            className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)]"
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value as "all" | "missing")}
          >
            <option value="all">All images</option>
            <option value="missing">Missing descriptions</option>
          </select>
          <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="gallery-category">
            Category
          </label>
          <select
            id="gallery-category"
            className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)]"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.currentTarget.value as any)}
          >
            <option value="all">All</option>
            <option value="uncategorized">Uncategorized</option>
            {IMAGE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={refresh}
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:opacity-60"
            onClick={requestBulkDelete}
            disabled={!props.onDeleteImage || images.length === 0 || deleteStatus.kind === "loading"}
            title="Delete all images in this gallery"
          >
            Delete all
          </button>
        </div>
      </div>

      {status.kind === "error" ? (
        <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text)]">
          {status.message}
        </div>
      ) : null}

      <div className="mt-3 space-y-6">
        {sections.needsDescription.length > 0 ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--fc-text)]">
                Needs description{" "}
                <span className="ml-1 text-xs font-medium text-[var(--fc-text-muted)]">
                  ({sections.needsDescription.length})
                </span>
              </div>
              <div className="text-xs text-[var(--fc-text-muted)]">Click an image to write a simple caption.</div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
              {sections.needsDescription.map((img) => (
                <button
                  key={img.file_name}
                  type="button"
                  className={[
                    "group relative flex flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-[var(--fc-surface)] text-left transition-colors hover:bg-[var(--fc-surface-hover)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fc-bg)]",
                  ].join(" ")}
                  onClick={() => openByFileName(img.file_name)}
                  title="Open description editor"
                >
                  <div className="relative aspect-[4/5] w-full bg-black/10">
                    <img
                      src={srcForImage(img)}
                      alt={img.display_name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      loading="lazy"
                      onError={(e) => {
                        if (!img.thumb_path) return;
                        const el = e.currentTarget;
                        if (el.dataset.fallbackApplied === "1") return;
                        el.dataset.fallbackApplied = "1";
                        el.src = convertFileSrc(img.image_path);
                      }}
                    />
                    {(categoriesByFileName[img.file_name] ?? "").trim() ? (
                      <div className="absolute left-2 top-2 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-1 text-[10px] font-semibold text-[var(--fc-text)]">
                        {IMAGE_CATEGORIES.find((c) => c.id === categoriesByFileName[img.file_name])?.label ?? "Category"}
                      </div>
                    ) : null}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="min-w-0 truncate text-xs font-medium text-[var(--fc-text)]">
                      {compactLabel(img.display_name, 44)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {filter !== "missing" && sections.described.length > 0 ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--fc-text)]">
                Described{" "}
                <span className="ml-1 text-xs font-medium text-[var(--fc-text-muted)]">
                  ({sections.described.length})
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
              {sections.described.map((img) => (
                <button
                  key={img.file_name}
                  type="button"
                  className={[
                    "group relative flex flex-col overflow-hidden rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] text-left transition-colors hover:bg-[var(--fc-surface-hover)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fc-bg)]",
                  ].join(" ")}
                  onClick={() => openByFileName(img.file_name)}
                  title="Open description editor"
                >
                  <div className="relative aspect-[4/5] w-full bg-black/10">
                    <img
                      src={srcForImage(img)}
                      alt={img.display_name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      loading="lazy"
                      onError={(e) => {
                        if (!img.thumb_path) return;
                        const el = e.currentTarget;
                        if (el.dataset.fallbackApplied === "1") return;
                        el.dataset.fallbackApplied = "1";
                        el.src = convertFileSrc(img.image_path);
                      }}
                    />
                    {(categoriesByFileName[img.file_name] ?? "").trim() ? (
                      <div className="absolute left-2 top-2 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-1 text-[10px] font-semibold text-[var(--fc-text)]">
                        {IMAGE_CATEGORIES.find((c) => c.id === categoriesByFileName[img.file_name])?.label ?? "Category"}
                      </div>
                    ) : null}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="min-w-0 truncate text-xs font-medium text-[var(--fc-text)]">
                      {compactLabel(img.display_name, 44)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {status.kind === "loading" ? (
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">
            Loading images…
          </div>
        ) : null}
        {status.kind !== "loading" && visible.length === 0 ? (
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 text-sm text-[var(--fc-text-muted)]">
            No images to show yet.
          </div>
        ) : null}
      </div>

      <Modal
        open={!!selected}
        size="xl"
        title={selected ? `Edit description` : "Edit description"}
        description={selected ? selected.display_name : undefined}
        onClose={() => setSelectedIndex(null)}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => go(-1)}
              disabled={selectedIndex === null || selectedIndex <= 0}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => go(1)}
              disabled={selectedIndex === null || selectedIndex >= images.length - 1}
            >
              Next
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:opacity-60"
              onClick={remove}
              disabled={!selected || !props.onDeleteImage || captionStatus.kind === "loading" || deleteStatus.kind === "loading"}
              title="Remove this image from training"
            >
              Remove image
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              onClick={save}
              disabled={!selected || captionStatus.kind === "loading" || !dirty}
            >
              Save description
            </button>
          </>
        }
      >
        {selected ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/10">
                <img
                  src={convertFileSrc(selected.image_path)}
                  alt={selected.display_name}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
              <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="image-category">
                Category
              </label>
              <select
                id="image-category"
                className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)] disabled:opacity-60"
                value={selectedCategory}
                onChange={(e) => void updateSelectedCategory(e.currentTarget.value as ImageCategoryId)}
                disabled={categoryStatus.kind === "loading"}
              >
                <option value="">Uncategorized</option>
                {IMAGE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
                {categoryStatus.kind === "loading" ? "Saving category…" : null}
                {categoryStatus.kind === "error" ? categoryStatus.message : null}
              </div>

              <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="caption-editor">
                Description
              </label>
              <textarea
                id="caption-editor"
                className="mt-2 h-44 w-full resize-y rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)] sm:h-64 lg:h-80"
                placeholder="Write what’s in the image in plain language. Example: “A portrait photo of …”"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.currentTarget.value)}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fc-text-muted)]">
                <div>
                  {captionStatus.kind === "loading" ? "Loading…" : null}
                  {captionStatus.kind === "error" ? captionStatus.message : null}
                  {captionStatus.kind === "idle" ? (dirty ? "Unsaved changes." : "Saved.") : null}
                </div>
                <div>{captionDraft.trim() ? `${captionDraft.trim().length} characters` : "No description"}</div>
              </div>
              <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-text-muted)]">
                Keep it simple and specific. Use commas to list visible details. Avoid technical camera terms.
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteIntent !== null}
        size="md"
        title={deleteIntent?.kind === "bulk" ? "Delete all images?" : "Delete image?"}
        description={
          deleteIntent?.kind === "bulk"
            ? `${deleteIntent.fileNames.length} images will be removed from training. This cannot be undone.`
            : deleteIntent
              ? deleteIntent.displayName
              : undefined
        }
        onClose={() => (deleteStatus.kind === "loading" ? null : setDeleteIntent(null))}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => setDeleteIntent(null)}
              disabled={deleteStatus.kind === "loading"}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:opacity-60"
              onClick={confirmDelete}
              disabled={deleteStatus.kind === "loading" || !props.onDeleteImage}
            >
              {deleteStatus.kind === "loading"
                ? "Deletingâ€¦"
                : deleteIntent?.kind === "bulk"
                  ? "Delete all"
                  : "Delete image"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[var(--fc-text)]">
          <p>
            {deleteIntent?.kind === "bulk"
              ? "This will permanently remove every image in the gallery from training."
              : "This will permanently remove the selected image from training."}
          </p>
          {deleteStatus.kind === "error" ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
              {deleteStatus.message}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
