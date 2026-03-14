export function EngineStatusBanner(props: { onOpenSettings: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-warning-surface)] p-4 text-sm text-[var(--fc-text)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">System setup required before training.</div>
          <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Set up your rendering engine and Python environment in Settings.
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
          onClick={props.onOpenSettings}
        >
          Open Settings
        </button>
      </div>
    </div>
  );
}

