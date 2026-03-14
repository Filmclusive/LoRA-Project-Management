import { FolderSummary } from "@filmclusive/orchestrator";
import { WorkspaceTab } from "./LibraryUtils";

interface LibrarySidebarProps {
  departmentFolders: FolderSummary[];
  selectedDepartmentId: string | null;
  setSelectedDepartmentId: (id: string | null) => void;
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  departmentAssetCounts: Map<string, number>;
  branchFolders: FolderSummary[];
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  setMobileAssetsOpen: (open: boolean) => void;
  setCreateFolderOpen: (open: boolean) => void;
}

export function LibrarySidebar({
  departmentFolders,
  selectedDepartmentId,
  setSelectedDepartmentId,
  selectedFolderId,
  setSelectedFolderId,
  departmentAssetCounts,
  branchFolders,
  setWorkspaceTab,
  setMobileAssetsOpen,
  setCreateFolderOpen,
}: LibrarySidebarProps) {
  const selectedDepartment = departmentFolders.find((d) => d.id === selectedDepartmentId);

  return (
    <section className="col-span-12 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 lg:col-span-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-[var(--fc-text)]">Departments</div>
          <span className="rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--fc-text-muted)]">
            {departmentFolders.length}
          </span>
        </div>
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">
          {selectedDepartment ? `${departmentAssetCounts.get(selectedDepartment.id) ?? 0} assets` : "Choose a department"}
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs font-medium text-[var(--fc-text-muted)]">Department</label>
        <select
          className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
          value={selectedDepartmentId ?? ""}
          onChange={(event) => {
            const nextId = event.currentTarget.value || null;
            setSelectedDepartmentId(nextId);
            setSelectedFolderId(null);
            setWorkspaceTab("data");
            setMobileAssetsOpen(true);
          }}
        >
          <option value="" disabled>
            Select a department
          </option>
          {departmentFolders.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name} ({departmentAssetCounts.get(department.id) ?? 0})
            </option>
          ))}
        </select>
      </div>

      {selectedDepartmentId ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-[var(--fc-text)]">Folders</div>
              <span className="rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--fc-text-muted)]">
                {Math.max(0, branchFolders.length - 1)}
              </span>
            </div>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={() => setCreateFolderOpen(true)}
            >
              New folder
            </button>
          </div>
          <label className="mt-3 block text-xs font-medium text-[var(--fc-text-muted)]">Folder</label>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
            value={selectedFolderId ?? ""}
            onChange={(event) => {
              const nextId = event.currentTarget.value || null;
              setSelectedFolderId(nextId);
              setMobileAssetsOpen(true);
            }}
          >
            <option value="">All folders</option>
            {branchFolders
              .filter((folder) => folder.id !== selectedDepartmentId)
              .map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
          </select>
        </div>
      ) : null}
    </section>
  );
}
