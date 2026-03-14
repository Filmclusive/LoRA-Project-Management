import { listen } from "@tauri-apps/api/event";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createCharacter,
  deleteCharacterImage,
  generateCaptions,
  getCaptionStatus,
  getCharacterPaths,
  importImages,
  listCharacters,
  type CaptionStatusReport,
  type CharacterPaths,
  type CharacterSummary,
  type ImportResult,
} from "@filmclusive/orchestrator";
import { useProjectContext } from "./projectContext";
import { useUserPreferences } from "./userPreferences";

type UiState = { kind: "idle" } | { kind: "loading"; message: string } | { kind: "error"; message: string };

type Ctx = {
  status: UiState;
  characters: CharacterSummary[];
  selectedCharacterId: string;
  selectedCharacter: CharacterSummary | null;
  setSelectedCharacterId: (id: string) => void;
  refreshCharacters: (nextSelectedId?: string) => Promise<void>;
  createNewCharacter: (name: string) => Promise<CharacterSummary | null>;
  characterPaths: CharacterPaths | null;
  captionStatus: CaptionStatusReport | null;
  refreshCaptionStatus: () => Promise<CaptionStatusReport | null>;
  generateDescriptions: (presetId: string) => Promise<boolean>;
  lastImport: ImportResult | null;
  importFromPaths: (paths: string[]) => Promise<ImportResult | null>;
  deleteImage: (fileName: string) => Promise<boolean>;
};

const CharacterContext = createContext<Ctx | null>(null);

function storageKeyForCharacter(projectId: string) {
  return `filmclusive.activeCharacterId.v1.${projectId}`;
}

function readSelectedCharacterId(projectId: string): string {
  try {
    return localStorage.getItem(storageKeyForCharacter(projectId)) ?? "";
  } catch {
    return "";
  }
}

function writeSelectedCharacterId(projectId: string, id: string) {
  try {
    localStorage.setItem(storageKeyForCharacter(projectId), id);
  } catch {
    // ignore
  }
}

export function CharacterProvider(props: { children: React.ReactNode }) {
  const { selectedProjectId } = useProjectContext();
  const { preferences } = useUserPreferences();
  const [status, setStatus] = useState<UiState>({ kind: "idle" });
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacterId, _setSelectedCharacterId] = useState<string>("");
  const [characterPaths, setCharacterPaths] = useState<CharacterPaths | null>(null);
  const [captionStatus, setCaptionStatus] = useState<CaptionStatusReport | null>(null);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId],
  );
  const shouldHydrateCharacterData = useMemo(
    () =>
      preferences.activeSection === "assets" ||
      preferences.activeSection === "prep" ||
      preferences.activeSection === "create",
    [preferences.activeSection],
  );

  const setSelectedCharacterId = useMemo(
    () => (id: string) => {
      _setSelectedCharacterId(id);
      if (selectedProjectId) writeSelectedCharacterId(selectedProjectId, id);
      setCaptionStatus(null);
      setLastImport(null);
    },
    [selectedProjectId],
  );

  const refreshCharacters = useMemo(
    () => async (nextSelectedId?: string) => {
      if (!selectedProjectId) {
        setCharacters([]);
        setSelectedCharacterId("");
        return;
      }
      const list = await listCharacters({ projectId: selectedProjectId });
      setCharacters(list);
      const next = nextSelectedId ?? selectedCharacterId;
      if (next && list.some((c) => c.id === next)) {
        setSelectedCharacterId(next);
        return;
      }
      if (list.length > 0) setSelectedCharacterId(list[0]!.id);
      else setSelectedCharacterId("");
    },
    [selectedProjectId, selectedCharacterId, setSelectedCharacterId],
  );

  const createNewCharacter = useMemo(
    () => async (name: string) => {
      if (!selectedProjectId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      setStatus({ kind: "loading", message: "Creating character…" });
      try {
        const created = await createCharacter({ projectId: selectedProjectId, name: trimmed });
        await refreshCharacters(created.id);
        setStatus({ kind: "idle" });
        return created;
      } catch (e) {
        setStatus({ kind: "error", message: String(e) });
        return null;
      }
    },
    [selectedProjectId, refreshCharacters],
  );

  const refreshCaptionStatus = useMemo(
    () => async () => {
      if (!characterPaths) return null;
      try {
        const report = await getCaptionStatus({ datasetDir: characterPaths.images_dir });
        setCaptionStatus(report);
        return report;
      } catch {
        setCaptionStatus(null);
        return null;
      }
    },
    [characterPaths],
  );

  const generateDescriptions = useMemo(
    () => async (presetId: string) => {
      if (!characterPaths) return false;
      if (!presetId.trim()) return false;
      setStatus({ kind: "loading", message: "Generating descriptions…" });
      try {
        await generateCaptions({ datasetDir: characterPaths.images_dir, presetId });
        await refreshCaptionStatus();
        setStatus({ kind: "idle" });
        return true;
      } catch (e) {
        setStatus({ kind: "error", message: String(e) });
        return false;
      }
    },
    [characterPaths, refreshCaptionStatus],
  );

  const importFromPaths = useMemo(
    () => async (paths: string[]) => {
      if (!selectedProjectId || !selectedCharacterId) return null;
      const clean = paths.map((p) => p.trim()).filter(Boolean);
      if (clean.length === 0) return null;
      setStatus({ kind: "loading", message: "Importing images…" });
      try {
        const result = await importImages({ projectId: selectedProjectId, characterId: selectedCharacterId, sourcePaths: clean });
        setLastImport(result);
        await refreshCaptionStatus();
        await refreshCharacters(selectedCharacterId);
        setStatus({ kind: "idle" });
        return result;
      } catch (e) {
        setStatus({ kind: "error", message: String(e) });
        return null;
      }
    },
    [selectedProjectId, selectedCharacterId, refreshCaptionStatus, refreshCharacters],
  );

  const deleteImage = useMemo(
    () => async (fileName: string) => {
      if (!selectedProjectId || !selectedCharacterId) return false;
      const clean = fileName.trim();
      if (!clean) return false;
      setStatus({ kind: "loading", message: "Removing image…" });
      try {
        await deleteCharacterImage({ projectId: selectedProjectId, characterId: selectedCharacterId, fileName: clean });
        await refreshCaptionStatus();
        await refreshCharacters(selectedCharacterId);
        setStatus({ kind: "idle" });
        return true;
      } catch (e) {
        setStatus({ kind: "error", message: String(e) });
        return false;
      }
    },
    [refreshCaptionStatus, refreshCharacters, selectedCharacterId, selectedProjectId],
  );

  useEffect(() => {
    if (!selectedProjectId) {
      setCharacters([]);
      setSelectedCharacterId("");
      setCharacterPaths(null);
      setCaptionStatus(null);
      setLastImport(null);
      return;
    }
    if (!shouldHydrateCharacterData) return;
    const stored = readSelectedCharacterId(selectedProjectId);
    if (stored && stored !== selectedCharacterId) _setSelectedCharacterId(stored);
    setStatus({ kind: "loading", message: "Loading characters…" });
    listCharacters({ projectId: selectedProjectId })
      .then((list) => {
        setCharacters(list);
        const nextId = stored || selectedCharacterId;
        if (!nextId && list.length > 0) setSelectedCharacterId(list[0]!.id);
        if (nextId && !list.some((c) => c.id === nextId)) setSelectedCharacterId(list[0]?.id ?? "");
        setStatus({ kind: "idle" });
      })
      .catch((e) => setStatus({ kind: "error", message: String(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, shouldHydrateCharacterData]);

  useEffect(() => {
    if (!shouldHydrateCharacterData || !selectedProjectId || !selectedCharacterId) {
      setCharacterPaths(null);
      setCaptionStatus(null);
      return;
    }
    getCharacterPaths({ projectId: selectedProjectId, characterId: selectedCharacterId })
      .then((p) => {
        setCharacterPaths(p);
      })
      .catch((e) => setStatus({ kind: "error", message: String(e) }));
  }, [selectedProjectId, selectedCharacterId, shouldHydrateCharacterData]);

  useEffect(() => {
    if (!shouldHydrateCharacterData) return;
    void refreshCaptionStatus();
  }, [characterPaths?.images_dir, refreshCaptionStatus, shouldHydrateCharacterData]);

  useEffect(() => {
    if (preferences.activeSection !== "assets") return;
    let unlistenDrop: null | (() => void) = null;
    (async () => {
      const d = await listen<string[]>("tauri://file-drop", async (e) => {
        const paths = e.payload ?? [];
        if (paths.length === 0) return;
        await importFromPaths(paths);
      });
      unlistenDrop = () => d();
    })().catch(() => {});

    return () => {
      unlistenDrop?.();
    };
  }, [importFromPaths, preferences.activeSection]);

  const value = useMemo(
    () => ({
      status,
      characters,
      selectedCharacterId,
      selectedCharacter,
      setSelectedCharacterId,
      refreshCharacters,
      createNewCharacter,
      characterPaths,
      captionStatus,
      refreshCaptionStatus,
      generateDescriptions,
      lastImport,
      importFromPaths,
      deleteImage,
    }),
    [
      status,
      characters,
      selectedCharacterId,
      selectedCharacter,
      setSelectedCharacterId,
      refreshCharacters,
      createNewCharacter,
      characterPaths,
      captionStatus,
      refreshCaptionStatus,
      generateDescriptions,
      lastImport,
      importFromPaths,
      deleteImage,
    ],
  );

  return <CharacterContext.Provider value={value}>{props.children}</CharacterContext.Provider>;
}

export function useCharacterContext() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error("useCharacterContext must be used within CharacterProvider");
  return ctx;
}
