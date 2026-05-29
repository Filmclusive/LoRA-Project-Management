import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { Sidebar, type StudioSection } from "./Sidebar";
import { useProjectContext } from "../../state/projectContext";
import { useUserPreferences } from "../../state/userPreferences";
import { useMediaQuery } from "../../lib/useMediaQuery";

export function AppShell(props: {
  section: StudioSection;
  onSectionChange: (next: StudioSection) => void;
  setupLocked: boolean;
  setupBypass: boolean;
  isSetupPreview: boolean;
  breadcrumb: BreadcrumbItem[];
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { preferences, updatePreferences } = useUserPreferences();
  const narrow = useMediaQuery("(max-width: 960px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!narrow) setSidebarOpen(false);
  }, [narrow]);

  const headerLeft = useMemo(() => {
    if (!narrow) return null;
    return (
      <button
        type="button"
        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation"
      >
        Menu
      </button>
    );
  }, [narrow]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--fc-bg)] font-sans text-[var(--fc-text)]">
      <Sidebar
        collapsed={preferences.sidebarCollapsed}
        onToggleCollapsed={() => updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed })}
        variant={narrow ? "overlay" : "docked"}
        open={sidebarOpen}
        onRequestClose={() => setSidebarOpen(false)}
        section={props.section}
        onSectionChange={props.onSectionChange}
        setupLocked={props.setupLocked}
        setupBypass={props.setupBypass}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={(id) => setSelectedProjectId(id)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-[var(--fc-border)] bg-[var(--fc-header)]">
          <div className="px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {headerLeft ? <div className="shrink-0">{headerLeft}</div> : null}
              <div className="min-w-0 flex-1">
                <Breadcrumb items={props.breadcrumb} right={props.headerRight} />
              </div>
            </div>
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 overflow-auto px-4 py-3 sm:px-5 sm:py-4">
            {props.isSetupPreview && props.section !== "settings" ? (
              <div className="mb-4 rounded-2xl border border-[var(--fc-warning-border)] bg-[var(--fc-warning-surface)] p-4 text-sm text-[var(--fc-text)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">Preview mode</div>
                    <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                      Browse real project data and capture screenshots while setup is still incomplete.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
                    onClick={() => updatePreferences({ activeSection: "settings", settingsTab: "system" })}
                  >
                    Open Setup
                  </button>
                </div>
              </div>
            ) : null}
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}
