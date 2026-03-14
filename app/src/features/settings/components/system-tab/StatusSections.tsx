interface StatusSectionsProps {
  engineReport: any;
  engineSetup: any;
  status: any;
  parsedStatusError: any;
}

export function StatusSections({
  engineReport,
  engineSetup,
  status,
  parsedStatusError,
}: StatusSectionsProps) {
  return (
    <>
      {engineReport ? (
        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--fc-text)]">Status</div>
            <div
              className={[
                "rounded-xl border px-3 py-1 text-xs font-semibold",
                engineReport.ok
                  ? "border-[var(--fc-success-border)] bg-[var(--fc-success-surface)] text-[var(--fc-success)]"
                  : "border-[var(--fc-warning-border)] bg-[var(--fc-warning-surface)] text-[var(--fc-warning)]",
              ].join(" ")}
            >
              {engineReport.ok ? "Ready" : "Needs setup"}
            </div>
          </div>
          <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
            Python {engineReport.python.version} • Torch{" "}
            {engineReport.torch.available ? engineReport.torch.version ?? "installed" : "not installed"}
          </div>
          {engineReport.messages.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
              {engineReport.messages.slice(0, 6).map((m: string, idx: number) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {engineSetup ? (
        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="text-sm font-semibold text-[var(--fc-text)]">Auto setup summary</div>
          <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
            Runtime: {engineSetup.used_bundled_runtime ? "Bundled with app" : "Created local environment"}
          </div>
          {engineSetup.steps.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
              {engineSetup.steps.slice(0, 6).map((s: string, idx: number) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {status.kind === "error" ? (
        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-[var(--fc-danger)]">{parsedStatusError?.message ?? status.message}</div>
              {parsedStatusError?.code ? (
                <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Error code: {parsedStatusError.code}</div>
              ) : null}
              {parsedStatusError?.nextSteps?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
                  {parsedStatusError.nextSteps.slice(0, 3).map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              ) : null}
              <details className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-xs text-[var(--fc-text)]">
                <summary className="cursor-pointer select-none font-semibold text-[var(--fc-text)]">
                  Details for developers
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="text-[var(--fc-text-muted)]">
                    {status.action} • {new Date(status.at).toLocaleString()}
                  </div>
                  {parsedStatusError?.details ? (
                    <pre className="whitespace-pre-wrap break-words rounded-lg bg-[var(--fc-panel)] p-2 text-[var(--fc-text)]">
                      {parsedStatusError.details}
                    </pre>
                  ) : null}
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-[var(--fc-panel)] p-2 text-[var(--fc-text)]">
                    {status.raw}
                  </pre>
                </div>
              </details>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={async () => {
                try {
                  const report = JSON.stringify({ action: status.action, at: status.at, raw: status.raw }, null, 2);
                  await navigator.clipboard.writeText(report);
                } catch {
                  // ignore
                }
              }}
            >
              Copy report
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
