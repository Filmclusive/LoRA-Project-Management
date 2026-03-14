import { FolderSummary } from "@filmclusive/orchestrator";
import { DepartmentPicker } from "./DepartmentPicker";

interface LibraryHeaderProps {
  search: string;
  setSearch: (search: string) => void;
  departmentFolders: FolderSummary[];
  selectedDepartmentId: string | null;
  setSelectedDepartmentId: (id: string | null) => void;
  departmentAssetCounts: Map<string, number>;
  onOpenHelp: () => void;
  onDepartmentChange: (departmentId: string) => void;
}

export function LibraryHeader({
  search,
  setSearch,
  departmentFolders,
  selectedDepartmentId,
  setSelectedDepartmentId,
  departmentAssetCounts,
  onOpenHelp,
  onDepartmentChange,
}: LibraryHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--fc-text)]">Assets</h2>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={onOpenHelp}
              title="What are assets and LoRAs?"
              aria-label="Open assets help"
            >
              Help
            </button>
          </div>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Assets keep your characters, props, and styles consistent across generations.
          </p>
        </div>
        <div className="w-full sm:max-w-sm">
          <input
            className="w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search assets, tags, trigger tokens"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div
            className="text-xs font-medium text-[var(--fc-text-muted)]"
            title="Departments help you group assets, like props, wardrobe, camera, or lighting."
          >
            Department
          </div>
          <DepartmentPicker
            departments={departmentFolders}
            selectedDepartmentId={selectedDepartmentId}
            departmentAssetCounts={departmentAssetCounts}
            onSelect={(id) => {
              if (!id) return;
              setSelectedDepartmentId(id);
              onDepartmentChange(id);
            }}
          />
        </div>
        <div className="text-sm text-[var(--fc-text-muted)]">
          {selectedDepartmentId ? "Choose an asset to add photos, write captions, and train a LoRA." : "Choose a department to get started."}
        </div>
      </div>
    </div>
  );
}

