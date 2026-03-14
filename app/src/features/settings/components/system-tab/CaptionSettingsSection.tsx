import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings } from "@filmclusive/orchestrator";

interface CaptionSettingsSectionProps {
  settings: AppSettings;
  saveSettings: (s: AppSettings) => Promise<unknown>;
}

export function CaptionSettingsSection({ settings, saveSettings }: CaptionSettingsSectionProps) {
  const [ollamaBaseUrlDraft, setOllamaBaseUrlDraft] = useState("");
  const [ollamaVisionModelDraft, setOllamaVisionModelDraft] = useState("");
  const [openaiCompatBaseUrlDraft, setOpenaiCompatBaseUrlDraft] = useState("");
  const [openaiCompatVisionModelDraft, setOpenaiCompatVisionModelDraft] = useState("");

  const [captionDraftDirty, setCaptionDraftDirty] = useState({
    ollamaBaseUrl: false,
    ollamaVisionModel: false,
    openaiCompatBaseUrl: false,
    openaiCompatVisionModel: false,
  });

  const captionDraftTimers = useRef<{
    ollamaBaseUrl: ReturnType<typeof setTimeout> | null;
    ollamaVisionModel: ReturnType<typeof setTimeout> | null;
    openaiCompatBaseUrl: ReturnType<typeof setTimeout> | null;
    openaiCompatVisionModel: ReturnType<typeof setTimeout> | null;
  }>({
    ollamaBaseUrl: null,
    ollamaVisionModel: null,
    openaiCompatBaseUrl: null,
    openaiCompatVisionModel: null,
  });

  useEffect(() => {
    if (!captionDraftDirty.ollamaBaseUrl) setOllamaBaseUrlDraft(settings.ollama_base_url ?? "");
    if (!captionDraftDirty.ollamaVisionModel) setOllamaVisionModelDraft(settings.ollama_vision_model ?? "");
    if (!captionDraftDirty.openaiCompatBaseUrl) setOpenaiCompatBaseUrlDraft(settings.openai_compat_base_url ?? "");
    if (!captionDraftDirty.openaiCompatVisionModel)
      setOpenaiCompatVisionModelDraft(settings.openai_compat_vision_model ?? "");
  }, [
    settings,
    captionDraftDirty.ollamaBaseUrl,
    captionDraftDirty.ollamaVisionModel,
    captionDraftDirty.openaiCompatBaseUrl,
    captionDraftDirty.openaiCompatVisionModel,
  ]);

  const scheduleCaptionDraftSave = useCallback(
    (field: keyof AppSettings, value: string, timerKey: keyof typeof captionDraftTimers.current, dirtyKey: keyof typeof captionDraftDirty) => {
      setCaptionDraftDirty((prev) => ({ ...prev, [dirtyKey]: true }));
      const timers = captionDraftTimers.current;
      if (timers[timerKey]) clearTimeout(timers[timerKey]);
      timers[timerKey] = setTimeout(async () => {
        await saveSettings({ ...settings, [field]: value } as AppSettings);
        setCaptionDraftDirty((prev) => ({ ...prev, [dirtyKey]: false }));
      }, 450);
    },
    [saveSettings, settings],
  );

  const commitCaptionDraftSave = useCallback(
    async (field: keyof AppSettings, value: string, timerKey: keyof typeof captionDraftTimers.current, dirtyKey: keyof typeof captionDraftDirty) => {
      const timers = captionDraftTimers.current;
      if (timers[timerKey]) {
        clearTimeout(timers[timerKey]);
        timers[timerKey] = null;
      }
      await saveSettings({ ...settings, [field]: value } as AppSettings);
      setCaptionDraftDirty((prev) => ({ ...prev, [dirtyKey]: false }));
    },
    [saveSettings, settings],
  );

  const backend = settings.caption_backend?.trim() ? settings.caption_backend : "sidecar";
  const provider = settings.vision_caption_provider?.trim() ? settings.vision_caption_provider : "ollama";

  return (
    <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 md:col-span-2">
      <div className="text-xs font-medium text-[var(--fc-text-muted)]">Caption generation</div>
      <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
        Choose how captions are generated when you click Generate Captions.
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Backend</div>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
            value={backend}
            onChange={(event) => void saveSettings({ ...settings, caption_backend: event.currentTarget.value })}
          >
            <option value="sidecar">Deterministic (offline)</option>
            <option value="blip">BLIP (offline)</option>
            <option value="vision">Vision model (local)</option>
          </select>
        </div>

        {backend === "vision" ? (
          <div>
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Provider</div>
            <select
              className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
              value={provider}
              onChange={(event) => void saveSettings({ ...settings, vision_caption_provider: event.currentTarget.value })}
            >
              <option value="ollama">Ollama</option>
              <option value="openai">LM Studio (OpenAI API)</option>
            </select>
          </div>
        ) : null}
      </div>

      {backend === "vision" ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {provider === "ollama" ? (
            <>
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Ollama base URL</div>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
                  value={ollamaBaseUrlDraft}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setOllamaBaseUrlDraft(next);
                    scheduleCaptionDraftSave("ollama_base_url", next, "ollamaBaseUrl", "ollamaBaseUrl");
                  }}
                  onBlur={(event) =>
                    void commitCaptionDraftSave("ollama_base_url", event.currentTarget.value, "ollamaBaseUrl", "ollamaBaseUrl")
                  }
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Ollama vision model</div>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
                  value={ollamaVisionModelDraft}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setOllamaVisionModelDraft(next);
                    scheduleCaptionDraftSave("ollama_vision_model", next, "ollamaVisionModel", "ollamaVisionModel");
                  }}
                  onBlur={(event) =>
                    void commitCaptionDraftSave("ollama_vision_model", event.currentTarget.value, "ollamaVisionModel", "ollamaVisionModel")
                  }
                  placeholder="qwen2.5vl:7b"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">LM Studio base URL</div>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
                  value={openaiCompatBaseUrlDraft}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setOpenaiCompatBaseUrlDraft(next);
                    scheduleCaptionDraftSave("openai_compat_base_url", next, "openaiCompatBaseUrl", "openaiCompatBaseUrl");
                  }}
                  onBlur={(event) =>
                    void commitCaptionDraftSave(
                      "openai_compat_base_url",
                      event.currentTarget.value,
                      "openaiCompatBaseUrl",
                      "openaiCompatBaseUrl",
                    )
                  }
                  placeholder="http://localhost:1234"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">LM Studio vision model</div>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
                  value={openaiCompatVisionModelDraft}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setOpenaiCompatVisionModelDraft(next);
                    scheduleCaptionDraftSave(
                      "openai_compat_vision_model",
                      next,
                      "openaiCompatVisionModel",
                      "openaiCompatVisionModel",
                    );
                  }}
                  onBlur={(event) =>
                    void commitCaptionDraftSave(
                      "openai_compat_vision_model",
                      event.currentTarget.value,
                      "openaiCompatVisionModel",
                      "openaiCompatVisionModel",
                    )
                  }
                  placeholder="qwen/qwen3.5-35b-a3b"
                />
              </div>
            </>
          )}
        </div>
      ) : null}

      {backend === "vision" ? (
        <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
          Tip: start Ollama or LM Studio first. Use a vision/VL model ID (for example{" "}
          <span className="font-semibold text-[var(--fc-text)]">qwen2.5vl:7b</span> in Ollama). Captions are generated locally over{" "}
          <span className="font-semibold text-[var(--fc-text)]">http://localhost</span>.
        </div>
      ) : null}
    </div>
  );
}
