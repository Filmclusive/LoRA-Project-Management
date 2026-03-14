import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Component, lazy, Suspense, useState, type ErrorInfo, type ReactNode } from "react";
import { Modal } from "../../components/ui/Modal";
import { useUserPreferences } from "../../state/userPreferences";
import { useSettingsContext } from "../../state/settingsContext";
import { parseFilmclusiveError } from "../../lib/filmclusiveError";
import { FluxInstallLocationModal } from "./components/FluxInstallLocationModal";

const SystemTab = lazy(() => import("./tabs/SystemTab").then((module) => ({ default: module.SystemTab })));
const StorageTab = lazy(() => import("./tabs/StorageTab").then((module) => ({ default: module.StorageTab })));
const PerformanceTab = lazy(() => import("./tabs/PerformanceTab").then((module) => ({ default: module.PerformanceTab })));
const GPUTab = lazy(() => import("./tabs/GPUTab").then((module) => ({ default: module.GPUTab })));
const AppearanceTab = lazy(() => import("./tabs/AppearanceTab").then((module) => ({ default: module.AppearanceTab })));
const LoRATab = lazy(() => import("./tabs/LoRATab").then((module) => ({ default: module.LoRATab })));

const TABS = [
  { id: "system", label: "System" },
  { id: "storage", label: "Storage" },
  { id: "performance", label: "Performance" },
  { id: "gpu", label: "GPU" },
  { id: "lora", label: "LoRA" },
  { id: "appearance", label: "Appearance" },
] as const;

function TabFallback() {
  return <div className="font-sans text-sm text-[var(--fc-text-muted)]">Loading settings...</div>;
}

class SettingsTabErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Settings tab crashed:", error, info);
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: "" });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 font-sans">
          <div className="text-sm font-semibold text-[var(--fc-text)]">This settings tab hit a runtime error.</div>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Switch tabs and come back to retry. Error details are in the app console.</p>
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-[var(--fc-panel)] p-2 text-xs text-[var(--fc-text-muted)]">
            {this.state.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SettingsPage() {
  const { preferences, updatePreferences } = useUserPreferences();
  const {
    status,
    reload,
    settings,
    saveSettings,
    setupStatus,
    engineReport,
    runEngineCheck,
    autoSetup,
    fluxCatalog,
    fluxStatuses,
    installFluxModel,
    removeFluxModel,
    installSdxlBaseModel,
    installBlipWeights,
    removeSdxlBaseModel,
    removeBlipWeights,
    downloadProgressByModelId,
    downloadStatusByModelId,
    cancelDownload,
  } = useSettingsContext();

  const [fluxInstallOpen, setFluxInstallOpen] = useState(false);
  const [sdxlInstallOpen, setSdxlInstallOpen] = useState(false);
  const [blipInstallOpen, setBlipInstallOpen] = useState(false);
  const [setupInfoId, setSetupInfoId] = useState<"engine" | "flux" | "sdxl" | "blip" | null>(null);
  const fluxProgress = downloadProgressByModelId["flux1-schnell"] ?? null;
  const fluxDownloadStatus = downloadStatusByModelId["flux1-schnell"] ?? null;
  const sdxlProgress = downloadProgressByModelId["sdxl-base"] ?? null;
  const sdxlDownloadStatus = downloadStatusByModelId["sdxl-base"] ?? null;
  const blipProgress = downloadProgressByModelId["blip-weights"] ?? null;
  const blipDownloadStatus = downloadStatusByModelId["blip-weights"] ?? null;
  const activeFluxDownloadId =
    fluxProgress
      ? fluxProgress.downloadId
      : fluxDownloadStatus && fluxDownloadStatus.state === "started"
        ? fluxDownloadStatus.downloadId
        : null;
  const activeSdxlDownloadId =
    sdxlProgress
      ? sdxlProgress.downloadId
      : sdxlDownloadStatus && sdxlDownloadStatus.state === "started"
        ? sdxlDownloadStatus.downloadId
        : null;
  const activeBlipDownloadId =
    blipProgress
      ? blipProgress.downloadId
      : blipDownloadStatus && blipDownloadStatus.state === "started"
        ? blipDownloadStatus.downloadId
        : null;

  const setupLocked = !setupStatus?.ok;
  const setupBypass = preferences.setupBypass;
  const showOnlySystem = setupLocked && !setupBypass;
  const tab = showOnlySystem ? "system" : preferences.settingsTab;
  const visibleTabs = showOnlySystem ? TABS.filter((t) => t.id === "system") : TABS;

  const fluxEntry = fluxCatalog.find((entry) => entry.id === "flux1-schnell") ?? null;
  const fluxStatus = fluxStatuses.find((entry) => entry.id === "flux1-schnell") ?? null;
  const parsedStatusError = status.kind === "error" ? parseFilmclusiveError(status.raw) : null;

  const checklistItemBadge = (ok: boolean) =>
    ok
      ? "border-[var(--fc-success-border)] bg-[var(--fc-success-surface)] text-[var(--fc-success)]"
      : "border-[var(--fc-danger-border)] bg-[var(--fc-danger-surface)] text-[var(--fc-danger)]";

  const setupItems = [
    {
      id: "engine" as const,
      label: "Engine & Python",
      ok: Boolean(setupStatus?.engine_ok),
      primaryLabel: setupStatus?.engine_ok ? "Run check" : "Auto setup",
      primaryAction: setupStatus?.engine_ok ? runEngineCheck : autoSetup,
      disabled: status.kind === "loading",
      statusHint: engineReport?.ok ? "Checked" : null,
    },
    {
      id: "flux" as const,
      label: "FLUX Schnell",
      ok: Boolean(setupStatus?.flux_ok),
      primaryLabel: fluxStatus?.ready ? "Manage" : "Install",
      primaryAction: () => setFluxInstallOpen(true),
      disabled: status.kind === "loading" || !fluxEntry,
      statusHint: fluxProgress ? `Downloading ${fluxProgress.percent.toFixed(0)}%` : fluxDownloadStatus?.state === "paused" ? "Paused" : null,
    },
    {
      id: "sdxl" as const,
      label: "SDXL base model",
      ok: Boolean(setupStatus?.sdxl_base_model_ok),
      primaryLabel: setupStatus?.sdxl_base_model_ok ? "Manage" : "Install",
      primaryAction: () => setSdxlInstallOpen(true),
      disabled: status.kind === "loading" || !settings,
      statusHint: sdxlProgress ? `Downloading ${sdxlProgress.percent.toFixed(0)}%` : sdxlDownloadStatus?.state === "paused" ? "Paused" : null,
    },
    {
      id: "blip" as const,
      label: "BLIP weights",
      ok: Boolean(setupStatus?.blip_weights_ok),
      primaryLabel: setupStatus?.blip_weights_ok ? "Manage" : "Install",
      primaryAction: () => setBlipInstallOpen(true),
      disabled: status.kind === "loading" || !settings,
      statusHint: blipProgress ? `Downloading ${blipProgress.percent.toFixed(0)}%` : blipDownloadStatus?.state === "paused" ? "Paused" : null,
    },
  ];

  return (
    <div className="font-sans">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--fc-text)]">Settings</h2>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">System setup lives here, away from your creative workflow.</p>
        </div>
      </div>

      {setupLocked ? (
        <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--fc-text-muted)]">
              {setupBypass
                ? "Backdoor enabled to explore Prep and Create while setup is still in progress."
                : "Setup mode keeps the studio inside this page until the system check passes."
              }
            </p>
            <button
              type="button"
              onClick={() => updatePreferences({ setupBypass: !setupBypass })}
              aria-pressed={setupBypass}
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] transition hover:bg-[var(--fc-surface-hover)]"
            >
              {setupBypass ? "Hide Prep & Create sections" : "Show Prep & Create sections"}
            </button>
          </div>
        </div>
      ) : null}

      {showOnlySystem ? (
        <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--fc-text)]">Setup checklist</div>
              <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
                Complete these steps before the rest of the studio becomes available.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)]">
            <ul className="divide-y divide-[var(--fc-border)]">
              {setupItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-[var(--fc-text)]">{item.label}</div>
                      <span className={["rounded-full border px-2 py-0.5 text-xs font-semibold", checklistItemBadge(item.ok)].join(" ")}>
                        {item.ok ? "Ready" : "Not ready"}
                      </span>
                      {item.statusHint ? <span className="text-xs text-[var(--fc-text-muted)]">{item.statusHint}</span> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                      onClick={item.primaryAction}
                      disabled={item.disabled}
                    >
                      {item.primaryLabel}
                    </button>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                      aria-label={`More info about ${item.label}`}
                      onClick={() => setSetupInfoId(item.id)}
                    >
                      i
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Modal
        open={setupInfoId !== null}
        title={
          setupInfoId === "engine"
            ? "Engine & Python"
            : setupInfoId === "flux"
              ? "FLUX Schnell"
              : setupInfoId === "sdxl"
                ? "SDXL base model"
                : setupInfoId === "blip"
                  ? "BLIP weights"
                  : "Setup details"
        }
        description="Quick status plus advanced actions. Close this to return to the checklist."
        onClose={() => setSetupInfoId(null)}
        footer={
          setupInfoId === "engine" ? (
            <>
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                onClick={runEngineCheck}
                disabled={status.kind === "loading"}
              >
                Run check
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                onClick={autoSetup}
                disabled={status.kind === "loading"}
              >
                Auto setup
              </button>
            </>
          ) : setupInfoId === "flux" ? (
            <>
              {activeFluxDownloadId ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={status.kind === "loading"}
                  onClick={() => void cancelDownload(activeFluxDownloadId)}
                >
                  Pause
                </button>
              ) : fluxDownloadStatus?.state === "paused" ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={status.kind === "loading" || !fluxEntry}
                  onClick={() => {
                    setSetupInfoId(null);
                    setFluxInstallOpen(true);
                  }}
                >
                  Resume
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={!(fluxStatus?.installed || fluxDownloadStatus?.state === "paused") || status.kind === "loading"}
                onClick={() => void removeFluxModel("flux1-schnell")}
              >
                Remove
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                disabled={status.kind === "loading" || !fluxEntry}
                onClick={() => {
                  setSetupInfoId(null);
                  setFluxInstallOpen(true);
                }}
              >
                {fluxStatus?.ready ? "Reinstall" : "Install"}
              </button>
            </>
          ) : setupInfoId === "sdxl" ? (
            <>
              {activeSdxlDownloadId ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={status.kind === "loading"}
                  onClick={() => void cancelDownload(activeSdxlDownloadId)}
                >
                  Pause
                </button>
              ) : sdxlDownloadStatus?.state === "paused" ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={status.kind === "loading" || !settings}
                  onClick={() => {
                    setSetupInfoId(null);
                    setSdxlInstallOpen(true);
                  }}
                >
                  Resume
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={status.kind === "loading" || !settings}
                onClick={() => void removeSdxlBaseModel()}
              >
                Remove
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                disabled={status.kind === "loading" || !settings}
                onClick={() => {
                  setSetupInfoId(null);
                  setSdxlInstallOpen(true);
                }}
              >
                Install
              </button>
            </>
          ) : setupInfoId === "blip" ? (
            <>
              {activeBlipDownloadId ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={status.kind === "loading"}
                  onClick={() => void cancelDownload(activeBlipDownloadId)}
                >
                  Pause
                </button>
              ) : blipDownloadStatus?.state === "paused" ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={status.kind === "loading" || !settings}
                  onClick={() => {
                    setSetupInfoId(null);
                    setBlipInstallOpen(true);
                  }}
                >
                  Resume
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={status.kind === "loading" || !settings}
                onClick={() => void removeBlipWeights()}
              >
                Remove
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                disabled={status.kind === "loading" || !settings}
                onClick={() => {
                  setSetupInfoId(null);
                  setBlipInstallOpen(true);
                }}
              >
                Install
              </button>
            </>
          ) : null
        }
      >
        {setupInfoId === "engine" ? (
          <div className="space-y-4 text-sm text-[var(--fc-text-muted)]">
            <div>
              <div className="text-sm font-semibold text-[var(--fc-text)]">Status</div>
              <div className="mt-1">
                {setupStatus?.engine_ok ? "Ready." : "Not ready yet."}{" "}
                {engineReport?.ok ? "Dependencies and engine files are ready." : "Run the check to see what still needs attention."}
              </div>
            </div>
            {setupStatus?.missing?.length ? (
              <div>
                <div className="text-sm font-semibold text-[var(--fc-text)]">What’s missing</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {setupStatus.missing.slice(0, 12).map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : setupInfoId === "flux" ? (
          <div className="space-y-4 text-sm text-[var(--fc-text-muted)]">
            <div>
              <div className="text-sm font-semibold text-[var(--fc-text)]">Status</div>
              <div className="mt-1">{fluxStatus?.ready ? "Installed and verified." : "Install the managed model bundle to enable training."}</div>
            </div>
            {fluxProgress ? (
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
                <div className="flex items-center justify-between gap-3 text-sm text-[var(--fc-text)]">
                  <span>{fluxProgress.fileName}</span>
                  <span>{fluxProgress.percent.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fc-panel)]">
                  <div className="h-full bg-[var(--fc-accent)]" style={{ width: `${fluxProgress.percent}%` }} />
                </div>
              </div>
            ) : null}
            {fluxDownloadStatus ? <div className="text-sm">{fluxDownloadStatus.message}</div> : null}
          </div>
        ) : setupInfoId === "sdxl" ? (
          <div className="space-y-4 text-sm text-[var(--fc-text-muted)]">
            <div>
              <div className="text-sm font-semibold text-[var(--fc-text)]">Status</div>
              <div className="mt-1">
                {setupStatus?.sdxl_base_model_ok ? "Ready." : "Not ready yet."}{" "}
                {settings?.sdxl_base_model_path?.trim()
                  ? `Current path: ${settings.sdxl_base_model_path}`
                  : "You can install the managed base model, or point to a local file/folder."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={status.kind === "loading" || !settings}
                onClick={async () => {
                  if (!settings) return;
                  const selected = await openDialog({ directory: false, multiple: false, title: "Select SDXL base model file" });
                  if (!selected || Array.isArray(selected)) return;
                  await saveSettings({ ...settings, sdxl_base_model_path: selected });
                }}
              >
                Choose file
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={status.kind === "loading" || !settings}
                onClick={async () => {
                  if (!settings) return;
                  const selected = await openDialog({ directory: true, multiple: false, title: "Select SDXL base model folder" });
                  if (!selected || Array.isArray(selected)) return;
                  await saveSettings({ ...settings, sdxl_base_model_path: selected });
                }}
              >
                Choose folder
              </button>
            </div>
            {sdxlProgress ? (
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
                <div className="flex items-center justify-between gap-3 text-sm text-[var(--fc-text)]">
                  <span>{sdxlProgress.fileName}</span>
                  <span>{sdxlProgress.percent.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fc-panel)]">
                  <div className="h-full bg-[var(--fc-accent)]" style={{ width: `${sdxlProgress.percent}%` }} />
                </div>
              </div>
            ) : null}
            {sdxlDownloadStatus ? <div className="text-sm">{sdxlDownloadStatus.message}</div> : null}
          </div>
        ) : setupInfoId === "blip" ? (
          <div className="space-y-4 text-sm text-[var(--fc-text-muted)]">
            <div>
              <div className="text-sm font-semibold text-[var(--fc-text)]">Status</div>
              <div className="mt-1">
                {setupStatus?.blip_weights_ok ? "Ready." : "Not ready yet."}{" "}
                {settings?.blip_caption_weights_path?.trim()
                  ? `Current path: ${settings.blip_caption_weights_path}`
                  : "You can install the managed weights, or point to a local model_large_caption.pth file."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={status.kind === "loading" || !settings}
                onClick={async () => {
                  if (!settings) return;
                  const selected = await openDialog({ directory: false, multiple: false, title: "Select BLIP caption weights file" });
                  if (!selected || Array.isArray(selected)) return;
                  await saveSettings({ ...settings, blip_caption_weights_path: selected });
                }}
              >
                Choose file
              </button>
            </div>
            {blipProgress ? (
              <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
                <div className="flex items-center justify-between gap-3 text-sm text-[var(--fc-text)]">
                  <span>{blipProgress.fileName}</span>
                  <span>{blipProgress.percent.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fc-panel)]">
                  <div className="h-full bg-[var(--fc-accent)]" style={{ width: `${blipProgress.percent}%` }} />
                </div>
              </div>
            ) : null}
            {blipDownloadStatus ? <div className="text-sm">{blipDownloadStatus.message}</div> : null}
          </div>
        ) : null}
      </Modal>

      <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)]">
        {status.kind === "loading" ? (
          <div className="border-b border-[var(--fc-border)] px-5 py-3 text-sm text-[var(--fc-text-muted)]">{status.message}</div>
        ) : null}
        {status.kind === "error" ? (
          <div className="border-b border-[var(--fc-border)] px-5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-[var(--fc-danger)]">{parsedStatusError?.message ?? status.message}</div>
                {parsedStatusError?.code ? (
                  <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Error code: {parsedStatusError.code}</div>
                ) : null}
                {parsedStatusError?.nextSteps?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
                    {parsedStatusError.nextSteps.slice(0, 3).map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                ) : null}
                <details className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-xs text-[var(--fc-text)]">
                  <summary className="cursor-pointer select-none font-semibold text-[var(--fc-text)]">Details for developers</summary>
                  <div className="mt-2 space-y-2">
                    <div className="text-[var(--fc-text-muted)]">
                      {status.action} • {new Date(status.at).toLocaleString()}
                    </div>
                    {parsedStatusError?.details ? (
                      <pre className="whitespace-pre-wrap break-words rounded-lg bg-[var(--fc-surface)] p-2 text-[var(--fc-text)]">
                        {parsedStatusError.details}
                      </pre>
                    ) : null}
                    <pre className="whitespace-pre-wrap break-words rounded-lg bg-[var(--fc-surface)] p-2 text-[var(--fc-text)]">
                      {status.raw}
                    </pre>
                  </div>
                </details>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                  onClick={reload}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                  onClick={async () => {
                    try {
                      const report = JSON.stringify({ action: status.action, at: status.at, raw: status.raw }, null, 2);
                      await navigator.clipboard.writeText(report);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Copy report
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1 border-b border-[var(--fc-border)] px-3 py-2">
          {visibleTabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-[var(--fc-surface)] text-[var(--fc-text)]"
                    : "text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text)]",
                ].join(" ")}
                onClick={() => updatePreferences({ settingsTab: t.id })}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          <SettingsTabErrorBoundary resetKey={tab}>
            <Suspense fallback={<TabFallback />}>
              {tab === "system" ? <SystemTab /> : null}
              {!showOnlySystem && tab === "storage" ? <StorageTab /> : null}
              {!showOnlySystem && tab === "performance" ? <PerformanceTab /> : null}
              {!showOnlySystem && tab === "gpu" ? <GPUTab /> : null}
              {!showOnlySystem && tab === "lora" ? <LoRATab /> : null}
              {!showOnlySystem && tab === "appearance" ? <AppearanceTab /> : null}
            </Suspense>
          </SettingsTabErrorBoundary>
        </div>
      </div>

      <FluxInstallLocationModal
        open={fluxInstallOpen}
        modelLabel="FLUX Schnell"
        currentModelDownloadRoot={settings?.model_download_root ?? ""}
        onClose={() => setFluxInstallOpen(false)}
        onInstall={async (args) => {
          if (!settings) return;
          setFluxInstallOpen(false);
          if (args.mode === "default") {
            await saveSettings({ ...settings, model_download_root: "" });
          } else if (args.mode === "custom") {
            await saveSettings({ ...settings, model_download_root: args.folder });
          }
          await installFluxModel("flux1-schnell");
        }}
      />

      <FluxInstallLocationModal
        open={sdxlInstallOpen}
        modelLabel="SDXL base model"
        currentModelDownloadRoot={settings?.model_download_root ?? ""}
        onClose={() => setSdxlInstallOpen(false)}
        onInstall={async (args) => {
          if (!settings) return;
          setSdxlInstallOpen(false);
          if (args.mode === "default") {
            await saveSettings({ ...settings, model_download_root: "" });
          } else if (args.mode === "custom") {
            await saveSettings({ ...settings, model_download_root: args.folder });
          }
          await installSdxlBaseModel();
        }}
      />

      <FluxInstallLocationModal
        open={blipInstallOpen}
        modelLabel="BLIP weights"
        currentModelDownloadRoot={settings?.model_download_root ?? ""}
        onClose={() => setBlipInstallOpen(false)}
        onInstall={async (args) => {
          if (!settings) return;
          setBlipInstallOpen(false);
          if (args.mode === "default") {
            await saveSettings({ ...settings, model_download_root: "" });
          } else if (args.mode === "custom") {
            await saveSettings({ ...settings, model_download_root: args.folder });
          }
          await installBlipWeights();
        }}
      />
    </div>
  );
}
