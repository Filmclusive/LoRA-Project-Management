import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsContext } from "../../../state/settingsContext";
import { parseFilmclusiveError } from "../../../lib/filmclusiveError";
import { Modal } from "../../../components/ui/Modal";
import { FluxInstallLocationModal } from "../components/FluxInstallLocationModal";
import type { AppSettings } from "@filmclusive/orchestrator";

import { WindowsEngineSection } from "../components/system-tab/WindowsEngineSection";
import { FluxModelSection } from "../components/system-tab/FluxModelSection";
import { ManualOverridesSection } from "../components/system-tab/ManualOverridesSection";
import { CaptionSettingsSection } from "../components/system-tab/CaptionSettingsSection";
import { WeightsAndVaeSection } from "../components/system-tab/WeightsAndVaeSection";
import { StatusSections } from "../components/system-tab/StatusSections";

export function SystemTab() {
  const {
    status,
    settings,
    saveSettings,
    engineReport,
    engineSetup,
    runEngineCheck,
    autoSetup,
    reload,
    platform,
    setupStatus,
    fluxCatalog,
    fluxStatuses,
    downloadProgressByModelId,
    downloadStatusByModelId,
    installFluxModel,
    removeFluxModel,
    installSdxlBaseModel,
    installBlipWeights,
    removeSdxlBaseModel,
    removeBlipWeights,
    cancelDownload,
  } = useSettingsContext();

  const parsedStatusError = status.kind === "error" ? parseFilmclusiveError(status.raw) : null;
  const [showHfToken, setShowHfToken] = useState(false);
  const [fluxInstallOpen, setFluxInstallOpen] = useState(false);
  const [sdxlInstallOpen, setSdxlInstallOpen] = useState(false);
  const [blipInstallOpen, setBlipInstallOpen] = useState(false);
  const [setupInfoId, setSetupInfoId] = useState<"engine" | "flux" | "sdxl" | "blip" | "advanced" | null>(null);
  const [huggingfaceTokenDraft, setHuggingfaceTokenDraft] = useState("");
  const [adapterCommandDraft, setAdapterCommandDraft] = useState("");
  const [adapterWorkingDirDraft, setAdapterWorkingDirDraft] = useState("");
  const [adapterArgsDraft, setAdapterArgsDraft] = useState("");
  const [textDraftDirty, setTextDraftDirty] = useState({
    huggingfaceToken: false,
    adapterCommand: false,
    adapterWorkingDir: false,
    adapterArgs: false,
  });

  const settingsRef = useRef<AppSettings | null>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    if (!textDraftDirty.huggingfaceToken) setHuggingfaceTokenDraft(settings.huggingface_token ?? "");
    if (!textDraftDirty.adapterCommand) setAdapterCommandDraft(settings.adapter_command ?? "");
    if (!textDraftDirty.adapterWorkingDir) setAdapterWorkingDirDraft(settings.adapter_working_dir ?? "");
    if (!textDraftDirty.adapterArgs) setAdapterArgsDraft(settings.adapter_args_template.join("\n"));
  }, [settings, textDraftDirty]);

  const commitTextSetting = useCallback(
    async (field: keyof AppSettings, value: string, dirtyKey: keyof typeof textDraftDirty) => {
      const base = settingsRef.current;
      if (!base) return;
      await saveSettings({ ...base, [field]: value } as AppSettings);
      setTextDraftDirty((prev) => ({ ...prev, [dirtyKey]: false }));
    },
    [saveSettings],
  );

  const commitStringArraySetting = useCallback(
    async (field: keyof AppSettings, value: string, dirtyKey: keyof typeof textDraftDirty) => {
      const base = settingsRef.current;
      if (!base) return;
      const next = value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      await saveSettings({ ...base, [field]: next } as AppSettings);
      setTextDraftDirty((prev) => ({ ...prev, [dirtyKey]: false }));
    },
    [saveSettings],
  );

  const fluxProgress = downloadProgressByModelId["flux1-schnell"] ?? null;
  const fluxDownloadStatus = downloadStatusByModelId["flux1-schnell"] ?? null;
  const sdxlProgress = downloadProgressByModelId["sdxl-base"] ?? null;
  const sdxlDownloadStatus = downloadStatusByModelId["sdxl-base"] ?? null;
  const blipProgress = downloadProgressByModelId["blip-weights"] ?? null;
  const blipDownloadStatus = downloadStatusByModelId["blip-weights"] ?? null;
  const fluxEntry = fluxCatalog.find((entry) => entry.id === "flux1-schnell") ?? null;
  const fluxStatus = fluxStatuses.find((entry) => entry.id === "flux1-schnell") ?? null;

  const hfAuthRequiredFlux =
    Boolean(fluxDownloadStatus) &&
    (fluxDownloadStatus?.message ?? "").toLowerCase().includes("hugging face authorization required");

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

  const checklistItemBadge = (ok: boolean) =>
    ok
      ? "border-[var(--fc-success-border)] bg-[var(--fc-success-surface)] text-[var(--fc-success)]"
      : "border-[var(--fc-danger-border)] bg-[var(--fc-danger-surface)] text-[var(--fc-danger)]";

  if (!settings) {
    if (status.kind === "error") {
      return (
        <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <div className="text-sm font-semibold text-[var(--fc-text)]">System setup</div>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Settings could not be loaded. This screen requires the desktop app backend to be available.
          </p>
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-danger)]">
            {parsedStatusError?.message ?? status.message}
          </div>
          <div className="mt-4 flex gap-2">
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
      );
    }
    return (
      <div className="text-sm text-[var(--fc-text-muted)]">
        {status.kind === "loading" ? status.message : "Loading system settings…"}
      </div>
    );
  }

  const setupItems = [
    {
      id: "engine" as const,
      label: "Engine & Python",
      ok: Boolean(setupStatus?.engine_ok),
      primaryLabel: setupStatus?.engine_ok ? "Run check" : "Auto setup",
      primaryAction: setupStatus?.engine_ok ? runEngineCheck : autoSetup,
      disabled: status.kind === "loading",
      hint: engineReport?.ok ? "Checked" : null,
    },
    {
      id: "flux" as const,
      label: "FLUX Schnell",
      ok: Boolean(setupStatus?.flux_ok),
      primaryLabel: fluxStatus?.ready ? "Manage" : "Install",
      primaryAction: () => setFluxInstallOpen(true),
      disabled: status.kind === "loading" || !fluxEntry,
      hint: hfAuthRequiredFlux
        ? "Token needed"
        : fluxProgress
          ? `Downloading ${fluxProgress.percent.toFixed(0)}%`
          : fluxDownloadStatus?.state === "paused"
            ? "Paused"
            : null,
    },
    {
      id: "sdxl" as const,
      label: "SDXL base model",
      ok: Boolean(setupStatus?.sdxl_base_model_ok),
      primaryLabel: setupStatus?.sdxl_base_model_ok ? "Manage" : "Install",
      primaryAction: () => setSdxlInstallOpen(true),
      disabled: status.kind === "loading",
      hint: sdxlProgress ? `Downloading ${sdxlProgress.percent.toFixed(0)}%` : sdxlDownloadStatus?.state === "paused" ? "Paused" : null,
    },
    {
      id: "blip" as const,
      label: "BLIP weights",
      ok: Boolean(setupStatus?.blip_weights_ok),
      primaryLabel: setupStatus?.blip_weights_ok ? "Manage" : "Install",
      primaryAction: () => setBlipInstallOpen(true),
      disabled: status.kind === "loading",
      hint: blipProgress ? `Downloading ${blipProgress.percent.toFixed(0)}%` : blipDownloadStatus?.state === "paused" ? "Paused" : null,
    },
  ];

  return (
    <div className="space-y-4 font-sans">
      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--fc-text)]">System setup</div>
            <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
              Install the required tools and models. Open info for details only when you need them.
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)]">
          <ul className="divide-y divide-[var(--fc-border)]">
            {setupItems.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-[var(--fc-text)]">{item.label}</div>
                    <span className={["rounded-full border px-2 py-0.5 text-xs font-semibold", checklistItemBadge(item.ok)].join(" ")}>
                      {item.ok ? "Ready" : "Not ready"}
                    </span>
                    {item.hint ? <span className="text-xs text-[var(--fc-text-muted)]">{item.hint}</span> : null}
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
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-[var(--fc-text-muted)]">Optional settings are tucked away to keep this screen readable.</div>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => setSetupInfoId("advanced")}
          >
            Advanced
          </button>
        </div>
      </div>

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
                  : setupInfoId === "advanced"
                    ? "Advanced settings"
                    : "Setup details"
        }
        description="Details live here so the main System tab stays simple."
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
          ) : null
        }
      >
        {setupInfoId === "engine" ? (
          <div className="space-y-4">
            <WindowsEngineSection platform={platform} statusKind={status.kind} />
            <StatusSections engineReport={engineReport} engineSetup={engineSetup} status={status} parsedStatusError={parsedStatusError} />
          </div>
        ) : setupInfoId === "flux" ? (
          <FluxModelSection
            fluxEntry={fluxEntry}
            fluxStatus={fluxStatus}
            settings={settings}
            saveSettings={saveSettings}
            huggingfaceTokenDraft={huggingfaceTokenDraft}
            setHuggingfaceTokenDraft={setHuggingfaceTokenDraft}
            setTextDraftDirty={setTextDraftDirty}
            showHfToken={showHfToken}
            setShowHfToken={setShowHfToken}
            commitTextSetting={commitTextSetting}
            setFluxInstallOpen={(open) => {
              setSetupInfoId(null);
              setFluxInstallOpen(open);
            }}
            removeFluxModel={removeFluxModel}
            fluxProgress={fluxProgress}
            fluxDownloadStatus={fluxDownloadStatus}
            activeFluxDownloadId={activeFluxDownloadId}
            cancelDownload={cancelDownload}
            hfAuthRequiredFlux={hfAuthRequiredFlux}
            statusKind={status.kind}
          />
        ) : setupInfoId === "sdxl" ? (
          <ManualOverridesSection
            settings={settings}
            saveSettings={saveSettings}
            statusKind={status.kind}
            activeSdxlDownloadId={activeSdxlDownloadId}
            cancelDownload={cancelDownload}
            sdxlProgress={sdxlProgress}
            sdxlDownloadStatus={sdxlDownloadStatus}
            setSdxlInstallOpen={(open) => {
              setSetupInfoId(null);
              setSdxlInstallOpen(open);
            }}
            removeSdxlBaseModel={removeSdxlBaseModel}
            adapterCommandDraft={adapterCommandDraft}
            setAdapterCommandDraft={setAdapterCommandDraft}
            adapterWorkingDirDraft={adapterWorkingDirDraft}
            setAdapterWorkingDirDraft={setAdapterWorkingDirDraft}
            adapterArgsDraft={adapterArgsDraft}
            setAdapterArgsDraft={setAdapterArgsDraft}
            setTextDraftDirty={setTextDraftDirty}
            commitTextSetting={commitTextSetting}
            commitStringArraySetting={commitStringArraySetting}
          />
        ) : setupInfoId === "blip" ? (
          <WeightsAndVaeSection
            settings={settings}
            saveSettings={saveSettings}
            statusKind={status.kind}
            setupStatus={setupStatus}
            blipProgress={blipProgress}
            blipDownloadStatus={blipDownloadStatus}
            activeBlipDownloadId={activeBlipDownloadId}
            cancelDownload={cancelDownload}
            setBlipInstallOpen={(open) => {
              setSetupInfoId(null);
              setBlipInstallOpen(open);
            }}
            removeBlipWeights={removeBlipWeights}
          />
        ) : setupInfoId === "advanced" ? (
          <div className="space-y-4">
            <CaptionSettingsSection settings={settings} saveSettings={saveSettings} />
            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
              <div className="text-sm font-semibold text-[var(--fc-text)]">Status</div>
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">Engine reports and error details.</div>
              <div className="mt-3">
                <StatusSections engineReport={engineReport} engineSetup={engineSetup} status={status} parsedStatusError={parsedStatusError} />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <FluxInstallLocationModal
        open={fluxInstallOpen}
        modelLabel="FLUX Schnell"
        currentModelDownloadRoot={settings.model_download_root ?? ""}
        onClose={() => setFluxInstallOpen(false)}
        onInstall={async (args) => {
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
        currentModelDownloadRoot={settings.model_download_root ?? ""}
        onClose={() => setSdxlInstallOpen(false)}
        onInstall={async (args) => {
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
        currentModelDownloadRoot={settings.model_download_root ?? ""}
        onClose={() => setBlipInstallOpen(false)}
        onInstall={async (args) => {
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
