import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createProject,
  deleteProject as deleteProjectApi,
  listProjects,
  renameProject as renameProjectApi,
  type ProjectSummary,
} from "@filmclusive/orchestrator";

type UiState = { kind: "idle" } | { kind: "loading"; message: string } | { kind: "error"; message: string };

type Ctx = {
  status: UiState;
  projects: ProjectSummary[];
  selectedProjectId: string;
  selectedProject: ProjectSummary | null;
  setSelectedProjectId: (id: string) => void;
  refreshProjects: (nextSelectedId?: string) => Promise<void>;
  createNewProject: (name: string) => Promise<ProjectSummary | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  renameProject: (projectId: string, name: string) => Promise<ProjectSummary | null>;
};

const ProjectContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "filmclusive.activeProjectId.v1";

function readSelectedProjectId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeSelectedProjectId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function ProjectProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UiState>({ kind: "idle" });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, _setSelectedProjectId] = useState<string>(() => readSelectedProjectId());

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const setSelectedProjectId = useMemo(
    () => (id: string) => {
      _setSelectedProjectId(id);
      writeSelectedProjectId(id);
    },
    [],
  );

  const refreshProjects = useMemo(
    () => async (nextSelectedId?: string) => {
      const list = await listProjects();
      setProjects(list);
      const next = nextSelectedId ?? selectedProjectId;
      if (next && list.some((p) => p.id === next)) {
        setSelectedProjectId(next);
        return;
      }
      if (list.length > 0) setSelectedProjectId(list[0]!.id);
      else setSelectedProjectId("");
    },
    [selectedProjectId, setSelectedProjectId],
  );

  const createNewProject = useMemo(
    () => async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      setStatus({ kind: "loading", message: "Creating project..." });
      try {
        const created = await createProject({ name: trimmed });
        await refreshProjects(created.id);
        setStatus({ kind: "idle" });
        return created;
      } catch (e) {
        setStatus({ kind: "error", message: String(e) });
        return null;
      }
    },
    [refreshProjects],
  );

  const deleteProject = useMemo(
    () => async (projectId: string) => {
      if (!projectId) return false;
      setStatus({ kind: "loading", message: "Deleting project..." });
      try {
        const ok = await deleteProjectApi({ projectId });
        await refreshProjects();
        setStatus({ kind: "idle" });
        return ok;
      } catch (e) {
        setStatus({ kind: "error", message: String(e) });
        return false;
      }
    },
    [refreshProjects],
  );

  const renameProject = useMemo(
    () => async (projectId: string, name: string) => {
      const trimmed = name.trim();
      if (!projectId || !trimmed) return null;
      setStatus({ kind: "loading", message: "Renaming project..." });
      try {
        const updated = await renameProjectApi({ projectId, name: trimmed });
        await refreshProjects(updated.id);
        setStatus({ kind: "idle" });
        return updated;
      } catch (e) {
        setStatus({ kind: "error", message: String(e) });
        return null;
      }
    },
    [refreshProjects],
  );

  useEffect(() => {
    let mounted = true;
    setStatus({ kind: "loading", message: "Loading projects..." });
    listProjects()
      .then((list) => {
        if (!mounted) return;
        setProjects(list);
        if (!selectedProjectId && list.length > 0) setSelectedProjectId(list[0]!.id);
        if (selectedProjectId && !list.some((p) => p.id === selectedProjectId)) {
          setSelectedProjectId(list[0]?.id ?? "");
        }
        setStatus({ kind: "idle" });
      })
      .catch((e) => mounted && setStatus({ kind: "error", message: String(e) }));
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      projects,
      selectedProjectId,
      selectedProject,
      setSelectedProjectId,
      refreshProjects,
      createNewProject,
      deleteProject,
      renameProject,
    }),
    [
      status,
      projects,
      selectedProjectId,
      selectedProject,
      setSelectedProjectId,
      refreshProjects,
      createNewProject,
      deleteProject,
      renameProject,
    ],
  );

  return <ProjectContext.Provider value={value}>{props.children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider");
  return ctx;
}
