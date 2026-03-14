import { lazy, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { StudioSection } from "./components/layout/Sidebar";
import { CharacterProvider } from "./state/characterContext";
import { ProjectProvider, useProjectContext } from "./state/projectContext";
import { SettingsProvider, useSettingsContext } from "./state/settingsContext";
import { UserPreferencesProvider, useUserPreferences } from "./state/userPreferences";

const BuildPage = lazy(() => import("./features/build/BuildPage").then((module) => ({ default: module.BuildPage })));
const LibraryPage = lazy(() => import("./features/library/LibraryPage").then((module) => ({ default: module.LibraryPage })));
const ProjectsPage = lazy(() => import("./features/projects/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const TrainingPage = lazy(() => import("./features/training/TrainingPage").then((module) => ({ default: module.TrainingPage })));

function SectionFallback() {
  return <div className="font-sans p-4 text-sm text-[var(--fc-text-muted)]">Loading section...</div>;
}

function StudioApp() {
  const { preferences, updatePreferences } = useUserPreferences();
  const { selectedProject } = useProjectContext();
  const { status: settingsStatus, setupStatus } = useSettingsContext();
  const settingsLoadingMessage = settingsStatus.kind === "loading" ? settingsStatus.message : "";

  const setupLocked = !setupStatus?.ok;
  const setupBypass = preferences.setupBypass;

  useEffect(() => {
    if (!setupLocked || setupBypass) return;
    if (preferences.activeSection === "settings" && preferences.settingsTab === "system") return;
    updatePreferences({ activeSection: "settings", settingsTab: "system" });
  }, [preferences.activeSection, preferences.settingsTab, setupBypass, setupLocked, updatePreferences]);

  const section: StudioSection = setupLocked && !setupBypass ? "settings" : preferences.activeSection;

const sectionLabel: Record<StudioSection, string> = {
  projects: "Projects",
  assets: "Assets",
  prep: "Prep",
  create: "Create",
  settings: "Settings",
};

  const breadcrumb = useMemo(() => {
    const items: Array<{ label: string }> = [];
    if (selectedProject && section !== "projects") items.push({ label: selectedProject.name });
    items.push({ label: sectionLabel[section] });
    return items;
  }, [selectedProject, section]);

  const headerRight = useMemo(() => {
    const parts: ReactNode[] = [];
    if (settingsStatus.kind === "loading") {
      parts.push(
        <div key="settings" className="text-sm text-[var(--fc-text-muted)]">
          {settingsStatus.message}
        </div>,
      );
    }
    if (parts.length === 0) return null;
    return <div className="flex items-center gap-2">{parts}</div>;
  }, [settingsStatus.kind, settingsLoadingMessage]);

  return (
    <AppShell
      section={section}
      setupLocked={setupLocked}
      setupBypass={setupBypass}
      onSectionChange={(next) => {
        if (setupLocked && !setupBypass && next !== "settings") {
          updatePreferences({ activeSection: "settings", settingsTab: "system" });
          return;
        }
        updatePreferences({ activeSection: next });
      }}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
    >
      <Suspense fallback={<SectionFallback />}>
        {section === "projects" ? (
          <ProjectsPage onOpenCharacters={() => updatePreferences({ activeSection: "assets" })} />
        ) : null}
        {section === "assets" ? <LibraryPage /> : null}
        {section === "prep" ? <BuildPage /> : null}
        {section === "create" ? (
          <TrainingPage
            onOpenSettings={() => updatePreferences({ activeSection: "settings", settingsTab: "system" })}
          />
        ) : null}
        {section === "settings" ? <SettingsPage /> : null}
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <UserPreferencesProvider>
      <SettingsProvider>
        <ProjectProvider>
          <CharacterProvider>
            <StudioApp />
          </CharacterProvider>
        </ProjectProvider>
      </SettingsProvider>
    </UserPreferencesProvider>
  );
}
