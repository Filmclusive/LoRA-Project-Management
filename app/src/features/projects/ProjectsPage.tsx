import { useEffect, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { useProjectContext } from "../../state/projectContext";

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ProjectsPage(props: { onOpenCharacters: () => void }) {
  const { status, projects, selectedProjectId, setSelectedProjectId, createNewProject, deleteProject, renameProject } =
    useProjectContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<{ projectId: string; rect: DOMRect } | null>(null);
  const [renameIntent, setRenameIntent] = useState<{ id: string; name: string } | null>(null);
  const [deleteIntent, setDeleteIntent] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [renameName, setRenameName] = useState("");

  const canCreate = useMemo(() => status.kind !== "loading" && name.trim().length > 0, [status.kind, name]);
  const canRename = useMemo(
    () =>
      status.kind !== "loading" &&
      renameIntent !== null &&
      renameName.trim().length > 0 &&
      renameName.trim() !== renameIntent.name.trim(),
    [status.kind, renameIntent, renameName],
  );

  useEffect(() => {
    if (openMenu === null) return;
    const onScrollOrResize = () => setOpenMenu(null);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [openMenu]);

  const openCreate = () => {
    setName("");
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (status.kind === "loading") return;
    setCreateOpen(false);
  };

  const handleCreateProject = async () => {
    const created = await createNewProject(name);
    if (!created) return;
    setCreateOpen(false);
    props.onOpenCharacters();
  };

  const confirmDelete = async () => {
    if (!deleteIntent) return;
    const ok = await deleteProject(deleteIntent.id);
    if (ok) setDeleteIntent(null);
  };

  const confirmRename = async () => {
    if (!renameIntent) return;
    const updated = await renameProject(renameIntent.id, renameName);
    if (updated) setRenameIntent(null);
  };

  const openMenuStyle = useMemo(() => {
    if (!openMenu) return null;
    const menuWidth = 160;
    const menuHeight = 96;
    const padding = 8;
    const desiredLeft = openMenu.rect.right - menuWidth;
    const left = Math.max(padding, Math.min(desiredLeft, window.innerWidth - menuWidth - padding));
    const belowTop = openMenu.rect.bottom + padding;
    const aboveTop = openMenu.rect.top - menuHeight - padding;
    const top = belowTop + menuHeight <= window.innerHeight ? belowTop : Math.max(padding, aboveTop);
    return { left, top, width: menuWidth };
  }, [openMenu]);

  return (
    <div className="font-sans">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--fc-text)]">Projects</h2>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Your projects keep assets, models, and training runs organized.
          </p>
        </div>
        {projects.length > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--fc-border)] px-3 py-1 text-sm font-semibold text-[var(--fc-accent)] transition hover:border-[var(--fc-accent)] hover:text-[var(--fc-accent)]"
            onClick={openCreate}
            disabled={status.kind === "loading"}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            <span>Add project</span>
          </button>
        ) : null}
      </div>

      {status.kind === "error" ? (
        <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-danger)]">
          {status.message}
        </div>
      ) : null}

        <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        {projects.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
            <div className="text-base font-semibold text-[var(--fc-text)]">Create your first project</div>
            <p className="max-w-md text-sm text-[var(--fc-text-muted)]">
              Create a project to start adding characters, props, wardrobe, and other assets.
            </p>
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-4 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              onClick={openCreate}
              disabled={status.kind === "loading"}
            >
              + Add project
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-medium text-[var(--fc-text-muted)]">
                  <th className="border-b border-[var(--fc-border)] px-3 py-2">Project</th>
                  <th className="border-b border-[var(--fc-border)] px-3 py-2">Assets</th>
                  <th className="border-b border-[var(--fc-border)] px-3 py-2">Updated</th>
                  <th className="border-b border-[var(--fc-border)] px-3 py-2">Status</th>
                  <th className="border-b border-[var(--fc-border)] px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => {
                    const active = p.id === selectedProjectId;
                    const assetCount = p.asset_count ?? p.character_count ?? 0;
                    const tdBorder = active ? "border-[var(--fc-border-strong)]" : "border-[var(--fc-border)]";
                    return (
                      <tr
                        key={p.id}
                        className={[
                          "group cursor-pointer text-sm text-[var(--fc-text)]",
                          active
                            ? "bg-[var(--fc-surface)] shadow-[inset_0_0_0_1px_var(--fc-border-strong)]"
                            : "hover:bg-[var(--fc-surface-hover)]",
                        ].join(" ")}
                        onClick={() => setSelectedProjectId(p.id)}
                      >
                        <td className={["border-b px-3 py-2", tdBorder].join(" ")}>
                          <div className="min-w-0 truncate font-semibold">{p.name}</div>
                        </td>
                        <td className={["border-b px-3 py-2 text-[var(--fc-text-muted)]", tdBorder].join(" ")}>
                          {assetCount}
                        </td>
                        <td className={["border-b px-3 py-2 text-[var(--fc-text-muted)]", tdBorder].join(" ")}>
                          {formatUpdatedAt(p.updated_at)}
                        </td>
                        <td className={["border-b px-3 py-2", tdBorder].join(" ")}>
                          {active ? (
                            <span className="inline-flex rounded-lg border border-[var(--fc-border-strong)] bg-[var(--fc-surface)] px-2 py-1 text-xs font-medium text-[var(--fc-text)]">
                              Active
                            </span>
                          ) : (
                            <span className="text-[var(--fc-text-faint)]">-</span>
                          )}
                        </td>
                        <td className={["border-b px-3 py-2 text-right", tdBorder].join(" ")}>
                          <div className="inline-block" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                              aria-label={`Project actions for ${p.name}`}
                              onClick={(e) => {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setOpenMenu((prev) => (prev?.projectId === p.id ? null : { projectId: p.id, rect }));
                              }}
                              disabled={status.kind === "loading"}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openMenu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close menu"
            onClick={() => setOpenMenu(null)}
          />
          <div
            className="fixed z-50 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-1 shadow-2xl"
            style={openMenuStyle ?? undefined}
            role="menu"
            aria-label="Project actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={() => {
                const project = projects.find((it) => it.id === openMenu.projectId);
                if (!project) return;
                setOpenMenu(null);
                setRenameName(project.name);
                setRenameIntent({ id: project.id, name: project.name });
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-500/10"
              onClick={() => {
                const project = projects.find((it) => it.id === openMenu.projectId);
                if (!project) return;
                setOpenMenu(null);
                setDeleteIntent({ id: project.id, name: project.name });
              }}
            >
              Delete
            </button>
          </div>
        </>
      ) : null}

      <Modal
        open={renameIntent !== null}
        size="md"
        title="Rename project"
        description={renameIntent ? `Rename "${renameIntent.name}"` : undefined}
        onClose={() => (status.kind === "loading" ? null : setRenameIntent(null))}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => setRenameIntent(null)}
              disabled={status.kind === "loading"}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              onClick={confirmRename}
              disabled={!canRename}
            >
              Save
            </button>
          </>
        }
      >
        <label className="block">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Project name</div>
          <input
            className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] placeholder:text-[var(--fc-text-faint)]"
            value={renameName}
            onChange={(e) => setRenameName(e.currentTarget.value)}
            disabled={status.kind === "loading"}
            autoFocus
          />
        </label>
      </Modal>

      <Modal
        open={createOpen}
        size="md"
        title="Add project"
        description="Give it a short, memorable name."
        onClose={closeCreate}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={closeCreate}
              disabled={status.kind === "loading"}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              onClick={handleCreateProject}
              disabled={!canCreate}
            >
              + Add project
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Project name</div>
            <input
              className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] placeholder:text-[var(--fc-text-faint)]"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. Short film, Portrait series"
              disabled={status.kind === "loading"}
              autoFocus
            />
          </label>
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Next steps</div>
            <div className="mt-1 text-sm text-[var(--fc-text)]">Add assets, then start a training run.</div>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteIntent !== null}
        size="md"
        title="Delete project?"
        description={deleteIntent?.name}
        onClose={() => (status.kind === "loading" ? null : setDeleteIntent(null))}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              onClick={() => setDeleteIntent(null)}
              disabled={status.kind === "loading"}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:opacity-60"
              onClick={confirmDelete}
              disabled={status.kind === "loading" || !deleteIntent}
            >
              {status.kind === "loading" ? "Deleting..." : "Delete project"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[var(--fc-text)]">
          <p>This will permanently remove the project and its local files. This cannot be undone.</p>
        </div>
      </Modal>
    </div>
  );
}
