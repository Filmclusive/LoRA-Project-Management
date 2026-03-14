import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  deriveFluxDownloadRoot,
  fileNameFromPath,
  fluxFileState,
  summarizeFluxProblems,
} from "./utils";
import type { AppSettings } from "@filmclusive/orchestrator";

type TextDraftDirtyKey = "huggingfaceToken" | "adapterCommand" | "adapterWorkingDir" | "adapterArgs";

interface FluxModelSectionProps {
  fluxEntry: any;
  fluxStatus: any;
  settings: AppSettings;
  saveSettings: (s: AppSettings) => Promise<unknown>;
  huggingfaceTokenDraft: string;
  setHuggingfaceTokenDraft: (v: string) => void;
  setTextDraftDirty: (v: any) => void;
  showHfToken: boolean;
  setShowHfToken: (v: boolean | ((p: boolean) => boolean)) => void;
  commitTextSetting: (field: keyof AppSettings, value: string, dirtyKey: TextDraftDirtyKey) => Promise<void>;
  setFluxInstallOpen: (v: boolean) => void;
  removeFluxModel: (id: string) => Promise<unknown>;
  fluxProgress: any;
  fluxDownloadStatus: any;
  activeFluxDownloadId: string | null;
  cancelDownload: (id: string) => Promise<unknown>;
  hfAuthRequiredFlux: boolean;
  statusKind: string;
}

export function FluxModelSection({
  fluxEntry,
  fluxStatus,
  settings,
  saveSettings,
  huggingfaceTokenDraft,
  setHuggingfaceTokenDraft,
  setTextDraftDirty,
  showHfToken,
  setShowHfToken,
  commitTextSetting,
  setFluxInstallOpen,
  removeFluxModel,
  fluxProgress,
  fluxDownloadStatus,
  activeFluxDownloadId,
  cancelDownload,
  hfAuthRequiredFlux,
  statusKind,
}: FluxModelSectionProps) {
  if (!fluxEntry) return null;

  const fluxKnownPaths = [
    fluxStatus?.base_model_path,
    fluxStatus?.ae_path,
    fluxStatus?.clip_l_path,
    fluxStatus?.t5xxl_path,
  ].filter((value): value is string => Boolean(value?.trim()));

  const fluxProblemSummary = summarizeFluxProblems(fluxStatus?.problems ?? [], fluxKnownPaths);
  const fluxFileStates = fluxStatus
    ? {
        baseModel: fluxFileState(fluxStatus.problems, fluxStatus.base_model_path),
        autoencoder: fluxFileState(fluxStatus.problems, fluxStatus.ae_path),
        clipL: fluxFileState(fluxStatus.problems, fluxStatus.clip_l_path),
        t5xxl: fluxFileState(fluxStatus.problems, fluxStatus.t5xxl_path),
      }
    : null;

  const fluxMissingEncoders =
    fluxStatus && fluxFileStates
      ? [
          fluxFileStates.clipL === "missing" ? fileNameFromPath(fluxStatus.clip_l_path) : null,
          fluxFileStates.t5xxl === "missing" ? fileNameFromPath(fluxStatus.t5xxl_path) : null,
        ].filter((value): value is string => Boolean(value))
      : [];

  const fluxCorruptedEncoders =
    fluxStatus && fluxFileStates
      ? [
          fluxFileStates.clipL === "corrupted" ? fileNameFromPath(fluxStatus.clip_l_path) : null,
          fluxFileStates.t5xxl === "corrupted" ? fileNameFromPath(fluxStatus.t5xxl_path) : null,
        ].filter((value): value is string => Boolean(value))
      : [];

  return (
    <div className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--fc-text)]">Base models</div>
          <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Filmclusive is pinned to commercial-use FLUX training in this phase. Install the managed FLUX Schnell bundle once and the app wires the training paths automatically.
          </div>
        </div>
        <span className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-muted)]">
          {fluxEntry.license}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fc-text)]">{fluxEntry.display_name}</div>
            <div className="mt-1 text-sm text-[var(--fc-text-muted)]">{fluxEntry.description}</div>
            <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
              Stored in the model download folder. Use “Choose folder” below to change it.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={fluxEntry.source_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            >
              Source
            </a>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              disabled={statusKind === "loading"}
              onClick={async () => {
                const selected = await openDialog({
                  directory: true,
                  multiple: false,
                  title: "Select existing FLUX install folder",
                });
                if (!selected || Array.isArray(selected)) return;
                const derivedRoot = deriveFluxDownloadRoot(selected);
                await saveSettings({ ...settings, model_download_root: derivedRoot });
              }}
            >
              Select model
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              disabled={statusKind === "loading"}
              onClick={() => setFluxInstallOpen(true)}
            >
              {fluxStatus?.ready ? "Re-download" : "Download model"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              disabled={!(fluxStatus?.installed || fluxDownloadStatus?.state === "paused") || statusKind === "loading"}
              onClick={() => void removeFluxModel(fluxEntry.id)}
            >
              Remove
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Install status</div>
            <div className="mt-1 text-sm text-[var(--fc-text)]">
              {fluxStatus?.ready
                ? "Installed and verified"
                : fluxStatus?.installed
                  ? "Installed but needs repair"
                  : "Not installed"}
            </div>
            {fluxStatus && !fluxStatus.ready && fluxFileStates?.baseModel === "missing" ? (
              <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
                Model missing: {fileNameFromPath(fluxStatus.base_model_path)}
              </div>
            ) : null}
            {fluxStatus && !fluxStatus.ready && fluxFileStates?.baseModel === "corrupted" ? (
              <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
                Model needs repair: {fileNameFromPath(fluxStatus.base_model_path)}
              </div>
            ) : null}
            {!fluxStatus?.ready && (fluxFileStates?.clipL === "missing" || fluxFileStates?.t5xxl === "missing") ? (
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                Encoders missing: {fluxMissingEncoders.join(", ")}
              </div>
            ) : null}
            {!fluxStatus?.ready && (fluxFileStates?.clipL === "corrupted" || fluxFileStates?.t5xxl === "corrupted") ? (
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                Encoders need repair: {fluxCorruptedEncoders.join(", ")}
              </div>
            ) : null}
            {fluxStatus && !fluxStatus.ready && fluxFileStates?.autoencoder === "missing" ? (
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                Autoencoder missing: {fileNameFromPath(fluxStatus.ae_path)}
              </div>
            ) : null}
            {fluxStatus && !fluxStatus.ready && fluxFileStates?.autoencoder === "corrupted" ? (
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                Autoencoder needs repair: {fileNameFromPath(fluxStatus.ae_path)}
              </div>
            ) : null}
            {!fluxStatus?.ready && !fluxFileStates && fluxProblemSummary.missing.length ? (
              <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
                Missing files: {fluxProblemSummary.missing.join(", ")}
              </div>
            ) : null}
            {!fluxStatus?.ready && !fluxFileStates && fluxProblemSummary.corrupted.length ? (
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                Files need repair: {fluxProblemSummary.corrupted.join(", ")}
              </div>
            ) : null}
            {fluxProblemSummary.otherCount ? (
              <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
                {fluxProblemSummary.otherCount} additional check{fluxProblemSummary.otherCount === 1 ? "" : "s"} available in details.
              </div>
            ) : null}
            {fluxStatus?.problems?.length ? (
              <details className="mt-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text-muted)]">
                <summary className="cursor-pointer select-none text-sm font-medium text-[var(--fc-text)]">
                  Show details
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
                  {fluxStatus.problems.map((problem: string, index: number) => (
                    <li key={index} className="break-words">
                      {problem}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Managed files</div>
            <div className="mt-1 text-sm text-[var(--fc-text)]">
              Base model:{" "}
              <span
                title={fluxStatus?.base_model_path ? fluxStatus.base_model_path : undefined}
                className="break-words"
              >
                {fluxStatus?.base_model_path ? fileNameFromPath(fluxStatus.base_model_path) : "Not downloaded yet"}
              </span>
            </div>
            <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
              Autoencoder:{" "}
              <span title={fluxStatus?.ae_path ? fluxStatus.ae_path : undefined} className="break-words">
                {fluxStatus?.ae_path ? fileNameFromPath(fluxStatus.ae_path) : "ae.safetensors"}
              </span>
            </div>
            <div className="mt-1 text-xs text-[var(--fc-text-muted)]">
              Encoders:{" "}
              <span title={fluxStatus?.clip_l_path ? fluxStatus.clip_l_path : undefined} className="break-words">
                {fluxStatus?.clip_l_path ? fileNameFromPath(fluxStatus.clip_l_path) : "clip_l.safetensors"}
              </span>{" "}
              •{" "}
              <span title={fluxStatus?.t5xxl_path ? fluxStatus.t5xxl_path : undefined} className="break-words">
                {fluxStatus?.t5xxl_path ? fileNameFromPath(fluxStatus.t5xxl_path) : "t5xxl_fp16.safetensors"}
              </span>
            </div>
            {fluxKnownPaths.length ? (
              <details className="mt-2 text-xs text-[var(--fc-text-muted)]">
                <summary className="cursor-pointer select-none text-xs font-medium text-[var(--fc-text)]">
                  Show locations
                </summary>
                <div className="mt-2 space-y-1">
                  <div className="break-words">Install folder: {fluxStatus?.model_root}</div>
                  <div className="break-words">Base model: {fluxStatus?.base_model_path}</div>
                  <div className="break-words">Autoencoder: {fluxStatus?.ae_path}</div>
                  <div className="break-words">CLIP-L: {fluxStatus?.clip_l_path}</div>
                  <div className="break-words">T5 XXL: {fluxStatus?.t5xxl_path}</div>
                </div>
              </details>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Hugging Face access token (optional)</div>
          <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
            Some FLUX downloads are gated on Hugging Face. Accept the model terms on the Source page and use a read token if downloads fail with 401/403.
          </p>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <input
              className="w-full flex-1 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
              type={showHfToken ? "text" : "password"}
              value={huggingfaceTokenDraft}
              onChange={(event) => {
                setHuggingfaceTokenDraft(event.currentTarget.value);
                setTextDraftDirty((prev: any) => ({ ...prev, huggingfaceToken: true }));
              }}
              onBlur={() => void commitTextSetting("huggingface_token", huggingfaceTokenDraft, "huggingfaceToken")}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void commitTextSetting("huggingface_token", huggingfaceTokenDraft, "huggingfaceToken");
              }}
              placeholder="hf_…"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                onClick={() => setShowHfToken((prev) => !prev)}
              >
                {showHfToken ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                onClick={() => {
                  setHuggingfaceTokenDraft("");
                  void commitTextSetting("huggingface_token", "", "huggingfaceToken");
                }}
                disabled={!huggingfaceTokenDraft.trim()}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Model download location</div>
          <div className="mt-1 break-words text-sm text-[var(--fc-text)]">
            {settings.model_download_root?.trim() ? settings.model_download_root : "Default (Application Support)"}
          </div>
          <div className="mt-2 text-sm text-[var(--fc-text-muted)]">
            Managed base model downloads and Hugging Face caches are stored here.
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={async () => {
                const selected = await openDialog({
                  directory: true,
                  multiple: false,
                  title: "Select model download folder",
                });
                if (!selected || Array.isArray(selected)) return;
                await saveSettings({ ...settings, model_download_root: selected });
              }}
            >
              Choose folder
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={async () => {
                await saveSettings({ ...settings, model_download_root: "" });
              }}
            >
              Use default
            </button>
          </div>
        </div>

        {fluxProgress ? (
          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--fc-text)]">
              <span>{fluxProgress.fileName}</span>
              <span>{fluxProgress.percent.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fc-surface)]">
              <div className="h-full bg-[var(--fc-accent)]" style={{ width: `${fluxProgress.percent}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                disabled={!activeFluxDownloadId || statusKind === "loading"}
                onClick={() => (activeFluxDownloadId ? void cancelDownload(activeFluxDownloadId) : undefined)}
              >
                Pause download
              </button>
            </div>
          </div>
        ) : null}

        {fluxDownloadStatus ? (
          <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-text-muted)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{fluxDownloadStatus.message}</span>
              {fluxDownloadStatus.state === "started" ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
                  disabled={!activeFluxDownloadId || statusKind === "loading"}
                  onClick={() => (activeFluxDownloadId ? void cancelDownload(activeFluxDownloadId) : undefined)}
                >
                  Pause
                </button>
              ) : null}
              {fluxDownloadStatus.state === "paused" && fluxEntry ? (
                <button
                  type="button"
                  className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                  disabled={statusKind === "loading"}
                  onClick={() => setFluxInstallOpen(true)}
                >
                  Resume
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {hfAuthRequiredFlux && fluxEntry ? (
          <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3">
            <div className="text-sm font-semibold text-[var(--fc-text)]">Fix Hugging Face download</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--fc-text-muted)]">
              <li>Open the Hugging Face page and make sure you’re signed in.</li>
              <li>Accept the model terms (if prompted).</li>
              <li>Create a read token, paste it above, then click Install again.</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={fluxEntry.source_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
              >
                Open Hugging Face
              </a>
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              >
                Get token
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
