import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  autoSetupEngine,
  cancelDownload,
  downloadBlipWeights,
  downloadFluxModelBundle,
  getSetupStatus,
  getFluxModelStatus,
  getPlatform,
  getSettings,
  listFluxModelCatalog,
  listPresets,
  onDownloadProgress,
  onDownloadStatus,
  downloadSdxlBaseModel,
  removeBlipWeights,
  removeFluxModelBundle,
  removeSdxlBaseModel,
  runEnginePreflight,
  updateSettings,
  type AppSettings,
  type AutoSetupEngineResult,
  type DownloadProgressEvent,
  type DownloadStatusEvent,
  type EnginePreflightReport,
  type FluxCatalogEntry,
  type FluxModelInstallStatus,
  type PresetPublic,
  type SetupStatusReport,
} from "@filmclusive/orchestrator";
import { parseFilmclusiveError, stringifyUnknownError } from "../lib/filmclusiveError";

type UiState =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string; raw: string; action: string; at: string };

function shortMessageFromRaw(raw: string) {
  const firstLine = raw.trim().split("\n")[0] ?? "";
  return firstLine.trim() || raw.trim() || "Something went wrong.";
}

function buildUiError(action: string, error: unknown): Extract<UiState, { kind: "error" }> {
  const raw = stringifyUnknownError(error);
  const parsed = parseFilmclusiveError(raw);
  const message = parsed?.code ? `[${parsed.code}] ${parsed.message}` : parsed?.message ?? shortMessageFromRaw(raw);
  return { kind: "error", message, raw, action, at: new Date().toISOString() };
}

type Ctx = {
  status: UiState;
  platform: string;
  settings: AppSettings | null;
  reload: () => Promise<void>;
  saveSettings: (next: AppSettings) => Promise<AppSettings | null>;
  engineReport: EnginePreflightReport | null;
  engineSetup: AutoSetupEngineResult | null;
  runEngineCheck: () => Promise<EnginePreflightReport | null>;
  autoSetup: () => Promise<AutoSetupEngineResult | null>;
  setupStatus: SetupStatusReport | null;
  presets: PresetPublic[];
  selectedPresetId: string;
  setSelectedPresetId: (id: string) => void;
  selectedPreset: PresetPublic | null;
  fluxCatalog: FluxCatalogEntry[];
  fluxStatuses: FluxModelInstallStatus[];
  preferredFluxStatus: FluxModelInstallStatus | null;
  downloadProgress: DownloadProgressEvent | null;
  downloadStatus: DownloadStatusEvent | null;
  downloadProgressByModelId: Record<string, DownloadProgressEvent>;
  downloadStatusByModelId: Record<string, DownloadStatusEvent>;
  refreshFluxModels: () => Promise<void>;
  installFluxModel: (modelId: string) => Promise<void>;
  removeFluxModel: (modelId: string) => Promise<void>;
  installSdxlBaseModel: () => Promise<void>;
  installBlipWeights: () => Promise<void>;
  removeSdxlBaseModel: () => Promise<void>;
  removeBlipWeights: () => Promise<void>;
  cancelDownload: (downloadId: string) => Promise<boolean>;
};

const SettingsContext = createContext<Ctx | null>(null);

const PRESET_KEY = "filmclusive.selectedPresetId.v1";

function readPresetId(): string {
  try {
    return localStorage.getItem(PRESET_KEY) ?? "";
  } catch {
    return "";
  }
}

function writePresetId(id: string) {
  try {
    localStorage.setItem(PRESET_KEY, id);
  } catch {
    // ignore
  }
}

export function SettingsProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UiState>({ kind: "idle" });
  const [platform, setPlatform] = useState<string>("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [engineReport, setEngineReport] = useState<EnginePreflightReport | null>(null);
  const [engineSetup, setEngineSetup] = useState<AutoSetupEngineResult | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatusReport | null>(null);
  const [presets, setPresets] = useState<PresetPublic[]>([]);
  const [fluxCatalog, setFluxCatalog] = useState<FluxCatalogEntry[]>([]);
  const [fluxStatuses, setFluxStatuses] = useState<FluxModelInstallStatus[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressEvent | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatusEvent | null>(null);
  const [downloadProgressByModelId, setDownloadProgressByModelId] = useState<Record<string, DownloadProgressEvent>>({});
  const [downloadStatusByModelId, setDownloadStatusByModelId] = useState<Record<string, DownloadStatusEvent>>({});
  const [selectedPresetId, _setSelectedPresetId] = useState<string>(() => readPresetId());

  const setSelectedPresetId = useMemo(
    () => (id: string) => {
      _setSelectedPresetId(id);
      writePresetId(id);
    },
    [],
  );

  const refreshFluxModels = useCallback(async () => {
    const [catalog, statuses] = await Promise.all([listFluxModelCatalog(), getFluxModelStatus()]);
    setFluxCatalog(catalog);
    setFluxStatuses(statuses);
  }, []);

  const refreshSetup = useCallback(async () => {
    try {
      const next = await getSetupStatus();
      setSetupStatus(next);
      if (next.engine_report) setEngineReport(next.engine_report);
    } catch (e) {
      setSetupStatus(null);
      throw e;
    }
  }, []);

  const loadAll = useCallback(
    async (mountedRef: { mounted: boolean }) => {
      setStatus({ kind: "loading", message: "Loading studio..." });
      try {
        const [s, plat, setup] = await Promise.all([getSettings(), getPlatform(), getSetupStatus()]);
        if (!mountedRef.mounted) return;
        setSettings(s);
        setPlatform(plat);
        setSetupStatus(setup);
        if (setup.engine_report) setEngineReport(setup.engine_report);
        setStatus({ kind: "idle" });

        Promise.allSettled([listPresets(), listFluxModelCatalog(), getFluxModelStatus()])
          .then((results) => {
            if (!mountedRef.mounted) return;

            const presetResult = results[0];
            if (presetResult.status === "fulfilled") {
              const nextPresets = presetResult.value;
              setPresets(nextPresets);
              if (!selectedPresetId && nextPresets.length > 0) setSelectedPresetId(nextPresets[0]!.id);
            }

            const catalogResult = results[1];
            if (catalogResult.status === "fulfilled") setFluxCatalog(catalogResult.value);

            const statusResult = results[2];
            if (statusResult.status === "fulfilled") setFluxStatuses(statusResult.value);
          })
          .catch(() => {});
      } catch (e) {
        if (!mountedRef.mounted) return;
        setStatus(buildUiError("Load settings", e));
      }
    },
    [selectedPresetId, setSelectedPresetId],
  );
  const reload = useCallback(async () => {
    const mountedRef = { mounted: true };
    await loadAll(mountedRef);
  }, [loadAll]);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  const saveSettings = useMemo(
    () => async (next: AppSettings) => {
      try {
        const saved = await updateSettings({ settings: next });
        setSettings(saved);
        try {
          const statuses = await getFluxModelStatus();
          setFluxStatuses(statuses);
        } catch {
          // ignore
        }
        await refreshSetup();
        return saved;
      } catch (e) {
        setStatus(buildUiError("Save settings", e));
        return null;
      }
    },
    [refreshSetup],
  );

  const runEngineCheck = useMemo(
    () => async () => {
      setStatus({ kind: "loading", message: "Checking system setup..." });
      try {
        const report = await runEnginePreflight();
        setEngineReport(report);
        await refreshSetup();
        setStatus({ kind: "idle" });
        return report;
      } catch (e) {
        setStatus(buildUiError("Engine check", e));
        return null;
      }
    },
    [refreshSetup],
  );

  const autoSetup = useMemo(
    () => async () => {
      setStatus({ kind: "loading", message: "Setting up system..." });
      try {
        const result = await autoSetupEngine();
        setEngineSetup(result);
        setEngineReport(result.engine_report);
        const [refreshed, statuses] = await Promise.all([getSettings(), getFluxModelStatus()]);
        setSettings(refreshed);
        setFluxStatuses(statuses);
        await refreshSetup();
        setStatus({ kind: "idle" });
        return result;
      } catch (e) {
        setStatus(buildUiError("Auto setup", e));
        return null;
      }
    },
    [refreshSetup],
  );

  const installFluxModel = useMemo(
    () => async (modelId: string) => {
      setStatus({ kind: "loading", message: "Installing FLUX model..." });
      try {
        await downloadFluxModelBundle({ modelId });
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus(buildUiError("Install FLUX model", e));
      }
    },
    [],
  );

  const removeFluxModel = useMemo(
    () => async (modelId: string) => {
      setStatus({ kind: "loading", message: "Removing FLUX model..." });
      try {
        await removeFluxModelBundle({ modelId });
        const [nextSettings, statuses] = await Promise.all([getSettings(), getFluxModelStatus()]);
        setSettings(nextSettings);
        setFluxStatuses(statuses);
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus(buildUiError("Remove FLUX model", e));
      }
    },
    [],
  );

  const removeSdxlBaseModelJob = useMemo(
    () => async () => {
      setStatus({ kind: "loading", message: "Removing SDXL base model..." });
      try {
        await removeSdxlBaseModel();
        const [nextSettings, statuses] = await Promise.all([getSettings(), getFluxModelStatus()]);
        setSettings(nextSettings);
        setFluxStatuses(statuses);
        await refreshSetup();
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus(buildUiError("Remove SDXL base model", e));
      }
    },
    [refreshSetup],
  );

  const removeBlipWeightsJob = useMemo(
    () => async () => {
      setStatus({ kind: "loading", message: "Removing BLIP weights..." });
      try {
        await removeBlipWeights();
        const [nextSettings, statuses] = await Promise.all([getSettings(), getFluxModelStatus()]);
        setSettings(nextSettings);
        setFluxStatuses(statuses);
        await refreshSetup();
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus(buildUiError("Remove BLIP weights", e));
      }
    },
    [refreshSetup],
  );

  const installSdxlBaseModel = useMemo(
    () => async () => {
      setStatus({ kind: "loading", message: "Installing SDXL base model..." });
      try {
        await downloadSdxlBaseModel();
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus(buildUiError("Install SDXL base model", e));
      }
    },
    [],
  );

  const installBlipWeights = useMemo(
    () => async () => {
      setStatus({ kind: "loading", message: "Installing BLIP weights..." });
      try {
        await downloadBlipWeights();
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus(buildUiError("Install BLIP weights", e));
      }
    },
    [],
  );

  const cancelDownloadJob = useMemo(
    () => async (downloadId: string) => {
      try {
        return await cancelDownload({ downloadId });
      } catch (e) {
        setStatus(buildUiError("Cancel download", e));
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    const mountedRef = { mounted: true };
    loadAll(mountedRef);
    return () => {
      mountedRef.mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unlistenProgress: null | (() => void) = null;
    let unlistenStatus: null | (() => void) = null;
    (async () => {
      const progress = await onDownloadProgress((event) => {
        setDownloadProgress(event);
        setDownloadProgressByModelId((prev) => ({ ...prev, [event.modelId]: event }));
      });
      const status = await onDownloadStatus(async (event) => {
        setDownloadStatus(event);
        setDownloadStatusByModelId((prev) => ({ ...prev, [event.modelId]: event }));
        if (event.state === "completed") {
          setDownloadProgressByModelId((prev) => {
            const next = { ...prev };
            delete next[event.modelId];
            return next;
          });
          window.setTimeout(() => {
            setDownloadStatusByModelId((prev) => {
              const current = prev[event.modelId];
              if (!current || current.state !== "completed") return prev;
              const next = { ...prev };
              delete next[event.modelId];
              return next;
            });
          }, 2500);
        } else if (event.state === "failed") {
          setDownloadProgressByModelId((prev) => {
            const next = { ...prev };
            delete next[event.modelId];
            return next;
          });
        }
        if (event.state === "completed" || event.state === "failed" || event.state === "paused") {
          const [nextSettings, statuses] = await Promise.all([getSettings(), getFluxModelStatus()]);
          setSettings(nextSettings);
          setFluxStatuses(statuses);
          await refreshSetup();
        }
      });
      unlistenProgress = () => progress();
      unlistenStatus = () => status();
    })().catch(() => {});
    return () => {
      unlistenProgress?.();
      unlistenStatus?.();
    };
  }, []);

  const preferredFluxStatus = useMemo(
    () => fluxStatuses.find((status) => status.id === settings?.preferred_flux_model_id) ?? null,
    [fluxStatuses, settings?.preferred_flux_model_id],
  );

  const value = useMemo(
    () => ({
      status,
      platform,
      settings,
      reload,
      saveSettings,
      engineReport,
      engineSetup,
      runEngineCheck,
      autoSetup,
      setupStatus,
      presets,
      selectedPresetId,
      setSelectedPresetId,
      selectedPreset,
      fluxCatalog,
      fluxStatuses,
      preferredFluxStatus,
      downloadProgress,
      downloadStatus,
      downloadProgressByModelId,
      downloadStatusByModelId,
      refreshFluxModels,
      installFluxModel,
      removeFluxModel,
      installSdxlBaseModel,
      installBlipWeights,
      removeSdxlBaseModel: removeSdxlBaseModelJob,
      removeBlipWeights: removeBlipWeightsJob,
      cancelDownload: cancelDownloadJob,
    }),
    [
      status,
      platform,
      settings,
      reload,
      saveSettings,
      engineReport,
      engineSetup,
      runEngineCheck,
      autoSetup,
      setupStatus,
      presets,
      selectedPresetId,
      setSelectedPresetId,
      selectedPreset,
      fluxCatalog,
      fluxStatuses,
      preferredFluxStatus,
      downloadProgress,
      downloadStatus,
      downloadProgressByModelId,
      downloadStatusByModelId,
      refreshFluxModels,
      installFluxModel,
      removeFluxModel,
      installSdxlBaseModel,
      installBlipWeights,
      removeSdxlBaseModelJob,
      removeBlipWeightsJob,
      cancelDownloadJob,
    ],
  );

  return <SettingsContext.Provider value={value}>{props.children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsProvider");
  return ctx;
}
