import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { fileNameFromPath } from "./utils";
import type { AppSettings } from "@filmclusive/orchestrator";

type TextDraftDirtyKey = "huggingfaceToken" | "adapterCommand" | "adapterWorkingDir" | "adapterArgs";

interface ManualOverridesSectionProps {
  settings: AppSettings;
  saveSettings: (s: AppSettings) => Promise<unknown>;
  statusKind: string;
  activeSdxlDownloadId: string | null;
  cancelDownload: (id: string) => Promise<unknown>;
  sdxlProgress: any;
  sdxlDownloadStatus: any;
  setSdxlInstallOpen: (v: boolean) => void;
  removeSdxlBaseModel: () => Promise<unknown>;
  adapterCommandDraft: string;
  setAdapterCommandDraft: (v: string) => void;
  adapterWorkingDirDraft: string;
  setAdapterWorkingDirDraft: (v: string) => void;
  adapterArgsDraft: string;
  setAdapterArgsDraft: (v: string) => void;
  setTextDraftDirty: (v: any) => void;
  commitTextSetting: (field: keyof AppSettings, value: string, dirtyKey: TextDraftDirtyKey) => Promise<void>;
  commitStringArraySetting: (field: keyof AppSettings, value: string, dirtyKey: TextDraftDirtyKey) => Promise<void>;
}

export function ManualOverridesSection({
  settings,
  saveSettings,
  statusKind,
  activeSdxlDownloadId,
  cancelDownload,
  sdxlProgress,
  sdxlDownloadStatus,
  setSdxlInstallOpen,
  removeSdxlBaseModel,
  adapterCommandDraft,
  setAdapterCommandDraft,
  adapterWorkingDirDraft,
  setAdapterWorkingDirDraft,
  adapterArgsDraft,
  setAdapterArgsDraft,
  setTextDraftDirty,
  commitTextSetting,
  commitStringArraySetting,
}: ManualOverridesSectionProps) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">Manual base model override</div>
        <div className="mt-1 text-sm text-[var(--fc-text)]">
          {settings.sdxl_base_model_path?.trim() ? (
            <span title={settings.sdxl_base_model_path} className="break-words">
              {fileNameFromPath(settings.sdxl_base_model_path)}
            </span>
          ) : (
            "Not set"
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            disabled={statusKind === "loading"}
            onClick={() => setSdxlInstallOpen(true)}
          >
            Install
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={!activeSdxlDownloadId || statusKind === "loading"}
            onClick={() => (activeSdxlDownloadId ? void cancelDownload(activeSdxlDownloadId) : undefined)}
          >
            Pause
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
            disabled={statusKind === "loading"}
            onClick={() => void removeSdxlBaseModel()}
          >
            Remove
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              const selected = await openDialog({
                directory: false,
                multiple: false,
                title: "Select engine model file",
              });
              if (!selected || Array.isArray(selected)) return;
              await saveSettings({ ...settings, sdxl_base_model_path: selected });
            }}
          >
            Choose file
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              const selected = await openDialog({
                directory: true,
                multiple: false,
                title: "Select engine model folder",
              });
              if (!selected || Array.isArray(selected)) return;
              await saveSettings({ ...settings, sdxl_base_model_path: selected });
            }}
          >
            Choose folder
          </button>
        </div>
        {sdxlProgress ? (
          <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--fc-text)]">
              <span>{sdxlProgress.fileName}</span>
              <span>{sdxlProgress.percent.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fc-panel)]">
              <div className="h-full bg-[var(--fc-accent)]" style={{ width: `${sdxlProgress.percent}%` }} />
            </div>
          </div>
        ) : null}
        {sdxlDownloadStatus ? (
          <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text-muted)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{sdxlDownloadStatus.message}</span>
              {sdxlDownloadStatus.state === "paused" ? (
                <button
                  type="button"
                  className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                  disabled={statusKind === "loading"}
                  onClick={() => setSdxlInstallOpen(true)}
                >
                  Resume
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {settings.sdxl_base_model_path?.trim() ? (
          <details className="mt-3 text-xs text-[var(--fc-text-muted)]">
            <summary className="cursor-pointer select-none text-xs font-medium text-[var(--fc-text)]">
              Show location
            </summary>
            <div className="mt-2 break-words">{settings.sdxl_base_model_path}</div>
          </details>
        ) : null}
        <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
          Leave this alone when you are using the managed FLUX Schnell install. This field remains available for advanced overrides.
        </div>
      </div>

      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">Python executable</div>
        <div className="mt-1 text-sm text-[var(--fc-text)]">
          {settings.python_executable ? (
            <span title={settings.python_executable} className="break-words">
              {fileNameFromPath(settings.python_executable)}
            </span>
          ) : (
            "Not set"
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={async () => {
              const selected = await openDialog({
                directory: false,
                multiple: false,
                title: "Select Python executable",
              });
              if (!selected || Array.isArray(selected)) return;
              await saveSettings({ ...settings, python_executable: selected });
            }}
          >
            Choose
          </button>
        </div>
        {settings.python_executable ? (
          <details className="mt-3 text-xs text-[var(--fc-text-muted)]">
            <summary className="cursor-pointer select-none text-xs font-medium text-[var(--fc-text)]">
              Show location
            </summary>
            <div className="mt-2 break-words">{settings.python_executable}</div>
          </details>
        ) : null}
        <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
          Auto setup can create an environment for you, if needed.
        </div>
      </div>

      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 md:col-span-2">
        <div className="text-xs font-medium text-[var(--fc-text-muted)]">Trainer setup</div>
        <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
          Managed FLUX training uses the built-in engine automatically. You do not need to set a separate adapter command.
        </div>
        <details className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--fc-text)]">
            Advanced external trainer override
          </summary>
          <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
            Only use this when you intentionally want Filmclusive to call a separate trainer executable for a custom workflow.
          </div>
          <input
            className="mt-3 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
            value={adapterCommandDraft}
            onChange={(event) => {
              setAdapterCommandDraft(event.currentTarget.value);
              setTextDraftDirty((prev: any) => ({ ...prev, adapterCommand: true }));
            }}
            onBlur={() => void commitTextSetting("adapter_command", adapterCommandDraft, "adapterCommand")}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void commitTextSetting("adapter_command", adapterCommandDraft, "adapterCommand");
            }}
            placeholder="/path/to/your/trainer"
          />
          <input
            className="mt-3 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
            value={adapterWorkingDirDraft}
            onChange={(event) => {
              setAdapterWorkingDirDraft(event.currentTarget.value);
              setTextDraftDirty((prev: any) => ({ ...prev, adapterWorkingDir: true }));
            }}
            onBlur={() => void commitTextSetting("adapter_working_dir", adapterWorkingDirDraft, "adapterWorkingDir")}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void commitTextSetting("adapter_working_dir", adapterWorkingDirDraft, "adapterWorkingDir");
            }}
            placeholder="/path/to/working-directory"
          />
          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
            value={adapterArgsDraft}
            onChange={(event) => {
              setAdapterArgsDraft(event.currentTarget.value);
              setTextDraftDirty((prev: any) => ({ ...prev, adapterArgs: true }));
            }}
            onBlur={() => void commitStringArraySetting("adapter_args_template", adapterArgsDraft, "adapterArgs")}
            placeholder={"--dataset {datasetDir}\n--output {runDir}\n--base-model {baseModelPath}"}
          />
          <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
            One argument per line. Useful placeholders:{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{datasetDir}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{runDir}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{configPath}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{baseModelPath}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{modelArchitecture}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{triggerWord}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{triggerTokens}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{rank}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{steps}`}</span>,{" "}
            <span className="font-semibold text-[var(--fc-text)]">{`{samplePromptsPath}`}</span>.
          </div>
        </details>
      </div>
    </div>
  );
}
