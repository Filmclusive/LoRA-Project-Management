import { useEffect, useMemo, useRef, useState } from "react";
import { useCharacterContext } from "../../state/characterContext";
import { useProjectContext } from "../../state/projectContext";
import { Modal } from "../ui/Modal";

export function CreateCharacterDialog(props: { open: boolean; onClose: () => void }) {
  const { selectedProjectId } = useProjectContext();
  const { status, createNewCharacter } = useCharacterContext();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setName("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [props.open]);

  const canCreate = useMemo(
    () => Boolean(selectedProjectId) && status.kind !== "loading" && name.trim().length > 0,
    [name, selectedProjectId, status.kind],
  );

  return (
    <Modal
      open={props.open}
      title="Create character"
      description="Characters store images, descriptions, and presets inside the active project."
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={props.onClose}
            disabled={status.kind === "loading"}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            onClick={async () => {
              const created = await createNewCharacter(name);
              if (created) props.onClose();
            }}
            disabled={!canCreate}
          >
            {status.kind === "loading" ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      <div className="space-y-3 font-sans">
        <div>
          <label className="text-xs font-medium text-[var(--fc-text-muted)]" htmlFor="new-character-name">
            Name
          </label>
          <input
            id="new-character-name"
            ref={inputRef}
            className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] placeholder:text-[var(--fc-text-faint)] outline-none focus:border-[var(--fc-border-strong)]"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="e.g. Wing, Jason"
            disabled={status.kind === "loading" || !selectedProjectId}
            autoComplete="off"
          />
        </div>

        {!selectedProjectId ? (
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text-muted)]">
            Select a project first.
          </div>
        ) : null}

        {status.kind === "error" ? (
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-danger)]">
            {status.message}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
