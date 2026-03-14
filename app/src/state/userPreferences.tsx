import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

export type UserPreferences = {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  showAdvancedTraining: boolean;
  setupBypass: boolean;
  activeSection: "projects" | "assets" | "prep" | "create" | "settings";
  settingsTab: "system" | "storage" | "performance" | "gpu" | "appearance" | "lora";
  characterTab: "overview" | "images" | "descriptions" | "dataset" | "presets";
  workflowAssetTab:
    | "characters"
    | "props"
    | "wardrobe"
    | "setDeck"
    | "camera"
    | "lighting"
    | "hairMakeup"
    | "vfx"
    | "look"
    | "other";
  trainingAssetTab:
    | "characters"
    | "props"
    | "wardrobe"
    | "setDeck"
    | "camera"
    | "lighting"
    | "hairMakeup"
    | "vfx"
    | "look"
    | "other";
};

const DEFAULTS: UserPreferences = {
  theme: "system",
  sidebarCollapsed: false,
  showAdvancedTraining: false,
  setupBypass: false,
  activeSection: "projects",
  settingsTab: "system",
  characterTab: "overview",
  workflowAssetTab: "characters",
  trainingAssetTab: "characters",
};

const STORAGE_KEY = "filmclusive.userPreferences.v1";

function readStored(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    const next = { ...DEFAULTS, ...parsed };
    const normalizeSection = (value: string | undefined): UserPreferences["activeSection"] => {
      switch (value) {
        case "library":
        case "characters":
        case "models":
          return "assets";
        case "build":
        case "workflow":
          return "prep";
        case "training":
          return "create";
        case "projects":
        case "assets":
        case "prep":
        case "create":
        case "settings":
          return value;
        default:
          return "projects";
      }
    };
    const incomingSection = (parsed as Partial<UserPreferences> & { activeSection?: string }).activeSection;
    next.activeSection = normalizeSection(incomingSection ?? next.activeSection);
    if (
      next.settingsTab !== "system" &&
      next.settingsTab !== "storage" &&
      next.settingsTab !== "performance" &&
      next.settingsTab !== "gpu" &&
      next.settingsTab !== "appearance" &&
      next.settingsTab !== "lora"
    ) {
      next.settingsTab = "system";
    }
    const kindIds = new Set([
      "characters",
      "props",
      "wardrobe",
      "setDeck",
      "camera",
      "lighting",
      "hairMakeup",
      "vfx",
      "look",
      "other",
    ]);
    if (!kindIds.has(next.workflowAssetTab)) next.workflowAssetTab = "characters";
    if (!kindIds.has(next.trainingAssetTab)) next.trainingAssetTab = "characters";
    return next;
  } catch {
    return { ...DEFAULTS };
  }
}

function writeStored(next: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function computeTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function applyThemePreference(pref: ThemePreference) {
  const resolved = computeTheme(pref);
  document.documentElement.dataset.theme = resolved;
}

type Ctx = {
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
};

const UserPreferencesContext = createContext<Ctx | null>(null);

export function UserPreferencesProvider(props: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => readStored());

  useEffect(() => {
    writeStored(preferences);
  }, [preferences]);

  useEffect(() => {
    applyThemePreference(preferences.theme);
    if (preferences.theme !== "system") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => applyThemePreference(preferences.theme);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [preferences.theme]);

  const updatePreferences = useMemo(
    () => (patch: Partial<UserPreferences>) => setPreferences((prev) => ({ ...prev, ...patch })),
    [],
  );

  const value = useMemo(() => ({ preferences, setPreferences, updatePreferences }), [preferences, updatePreferences]);

  return <UserPreferencesContext.Provider value={value}>{props.children}</UserPreferencesContext.Provider>;
}

export function useUserPreferences() {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) throw new Error("useUserPreferences must be used within UserPreferencesProvider");
  return ctx;
}
