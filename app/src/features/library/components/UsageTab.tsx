import { AssetSummary } from "@filmclusive/orchestrator";

interface UsageTabProps {
  selectedAsset: AssetSummary;
  notesDraft: string;
  setNotesDraft: (val: string) => void;
  handleSaveMetadata: () => void;
  savingMetadata: boolean;
}

export function UsageTab({
  selectedAsset,
  notesDraft,
  setNotesDraft,
  handleSaveMetadata,
  savingMetadata,
}: UsageTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">Prompt recipe</div>
        <div className="mt-2 text-sm text-[var(--fc-text)]">
          Use <span className="font-semibold">{selectedAsset.trigger_tokens.join(", ") || selectedAsset.name}</span> with a strength around{" "}
          <span className="font-semibold">0.7 to 0.9</span> to keep the asset recognizable while preserving scene composition.
        </div>
      </div>
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">Creative note</div>
        <textarea
          className="mt-2 min-h-32 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
          value={notesDraft}
          onChange={(event) => setNotesDraft(event.currentTarget.value)}
          placeholder="Prompt intent, negatives, and art-direction notes."
        />
        <div className="mt-3">
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            onClick={handleSaveMetadata}
            disabled={savingMetadata}
          >
            {savingMetadata ? "Saving…" : "Save creative note"}
          </button>
        </div>
      </div>
    </div>
  );
}
