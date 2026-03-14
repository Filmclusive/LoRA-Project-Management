interface CaptionsTabProps {
  triggerTokensDraft: string;
  setTriggerTokensDraft: (val: string) => void;
  tagsDraft: string;
  setTagsDraft: (val: string) => void;
  notesDraft: string;
  setNotesDraft: (val: string) => void;
  handleSaveMetadata: () => void;
  savingMetadata: boolean;
}

export function CaptionsTab({
  triggerTokensDraft,
  setTriggerTokensDraft,
  tagsDraft,
  setTagsDraft,
  notesDraft,
  setNotesDraft,
  handleSaveMetadata,
  savingMetadata,
}: CaptionsTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <label className="text-xs font-medium text-[var(--fc-text-muted)]">Trigger tokens</label>
        <input
          className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
          value={triggerTokensDraft}
          onChange={(event) => setTriggerTokensDraft(event.currentTarget.value)}
          placeholder="hero-token, prop-token"
        />
      </div>
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <label className="text-xs font-medium text-[var(--fc-text-muted)]">Tags</label>
        <input
          className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
          value={tagsDraft}
          onChange={(event) => setTagsDraft(event.currentTarget.value)}
          placeholder="cinematic, studio, wardrobe"
        />
      </div>
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <label className="text-xs font-medium text-[var(--fc-text-muted)]">Notes</label>
        <textarea
          className="mt-2 min-h-32 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
          value={notesDraft}
          onChange={(event) => setNotesDraft(event.currentTarget.value)}
          placeholder="Prompt intent, negatives, and art-direction notes."
        />
      </div>
      <button
        type="button"
        className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
        onClick={handleSaveMetadata}
        disabled={savingMetadata}
      >
        {savingMetadata ? "Saving…" : "Save metadata"}
      </button>
    </div>
  );
}
