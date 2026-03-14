import { useEffect, useRef } from "react";

export function Modal(props: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [props.open]);

  if (!props.open) return null;

  const maxWidth =
    props.size === "xl" ? "max-w-6xl" : props.size === "lg" ? "max-w-4xl" : "max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close dialog"
        onClick={props.onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className={[
          "relative flex w-full max-h-[calc(100dvh-2rem)] flex-col rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] shadow-2xl",
          maxWidth,
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--fc-border)] px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-[var(--fc-text)]">{props.title}</div>
            {props.description ? (
              <div className="mt-1 break-words text-sm text-[var(--fc-text-muted)]">{props.description}</div>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{props.children}</div>
        {props.footer ? (
          <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--fc-border)] px-5 py-4">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
