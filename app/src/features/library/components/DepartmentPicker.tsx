import { FolderSummary } from "@filmclusive/orchestrator";

interface DepartmentPickerProps {
  departments: FolderSummary[];
  selectedDepartmentId: string | null;
  departmentAssetCounts: Map<string, number>;
  onSelect: (id: string | null) => void;
}

export function DepartmentPicker({
  departments,
  selectedDepartmentId,
  departmentAssetCounts,
  onSelect,
}: DepartmentPickerProps) {
  const selected = departments.find((d) => d.id === selectedDepartmentId) ?? null;

  return (
    <details className="relative w-full sm:w-auto">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-bg)] px-3 py-2 text-sm text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] [&::marker]:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.name : "Choose a department"}
        </span>
        <span className="rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface-hover)] px-2 py-0.5 text-xs font-semibold text-[var(--fc-text-muted)]">
          {selected ? departmentAssetCounts.get(selected.id) ?? 0 : departments.length}
        </span>
      </summary>

      <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-64 overflow-hidden rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-bg)] shadow-2xl sm:w-72">
        <div className="border-b border-[var(--fc-border)] bg-[var(--fc-bg)] px-3 py-2 text-xs font-medium text-[var(--fc-text-muted)]">
          Department
        </div>
        <div className="max-h-72 overflow-auto p-1">
          {departments.map((department) => {
            const active = department.id === selectedDepartmentId;
            const count = departmentAssetCounts.get(department.id) ?? 0;
            return (
              <button
                key={department.id}
                type="button"
                className={[
                  "w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]",
                  active ? "bg-[var(--fc-surface)]" : "",
                ].join(" ")}
                onClick={(event) => {
                  (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                  onSelect(department.id);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{department.name}</span>
                  <span className="text-xs font-medium text-[var(--fc-text-muted)]">{count}</span>
                </div>
              </button>
            );
          })}
          {!departments.length ? (
            <div className="px-3 py-3 text-sm text-[var(--fc-text-muted)]">No departments found yet.</div>
          ) : null}
        </div>
      </div>
    </details>
  );
}
