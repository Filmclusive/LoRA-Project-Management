import { useEffect, useMemo, useState } from "react";
import { useSettingsContext } from "../../../state/settingsContext";
import { coerceTrainingConfig, DEFAULT_TRAINING_CONFIG, type TrainingConfig } from "../../../state/trainingConfig";

function numericValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampInt(value: number, opts: { min: number; max: number }) {
  if (!Number.isFinite(value)) return opts.min;
  return Math.max(opts.min, Math.min(opts.max, Math.round(value)));
}

function stepsFromEpochs(args: { images: number; repeats: number; epochs: number; batch: number; gradAcc: number }) {
  const denom = Math.max(1, Math.round(args.batch) * Math.max(1, Math.round(args.gradAcc)));
  const numer = Math.max(0, Math.round(args.images)) * Math.max(1, Math.round(args.repeats)) * Math.max(1, Math.round(args.epochs));
  return Math.max(1, Math.ceil(numer / denom));
}

function epochsFromSteps(args: { steps: number; images: number; repeats: number; batch: number; gradAcc: number }) {
  const denom = Math.max(1, Math.round(args.images) * Math.max(1, Math.round(args.repeats)));
  const numer = Math.max(1, Math.round(args.steps)) * Math.max(1, Math.round(args.batch)) * Math.max(1, Math.round(args.gradAcc));
  return numer / denom;
}

export function LoRATab() {
  const { settings, saveSettings } = useSettingsContext();
  const liveDefaults = useMemo(() => coerceTrainingConfig(settings?.training_defaults), [settings?.training_defaults]);

  const [draft, setDraft] = useState<TrainingConfig>(() => ({ ...DEFAULT_TRAINING_CONFIG }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoStepsFromImages, setAutoStepsFromImages] = useState(true);
  const [stepsPerImage, setStepsPerImage] = useState(100);
  const [minAutoSteps, setMinAutoSteps] = useState(100);
  const [maxAutoSteps, setMaxAutoSteps] = useState(6000);

  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonDirty, setJsonDirty] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [calcImages, setCalcImages] = useState("20");
  const [calcEpochs, setCalcEpochs] = useState("10");
  const [trainingStepsInput, setTrainingStepsInput] = useState(String(DEFAULT_TRAINING_CONFIG.training_steps));

  useEffect(() => {
    if (!settings) return;
    if (dirty || jsonDirty) return;
    setDraft(liveDefaults);
    setTrainingStepsInput(String(liveDefaults.training_steps));
    setAutoStepsFromImages(Boolean(settings.auto_steps_from_images));
    setStepsPerImage(Math.max(1, Math.round(settings.steps_per_image ?? 100)));
    setMinAutoSteps(Math.max(1, Math.round(settings.min_auto_steps ?? 100)));
    setMaxAutoSteps(Math.max(1, Math.round(settings.max_auto_steps ?? 6000)));
  }, [dirty, jsonDirty, liveDefaults, settings]);

  useEffect(() => {
    // Avoid serializing the full config on every keystroke while editing fields.
    if (jsonDirty || dirty) return;
    setJsonDraft(JSON.stringify(draft, null, 2));
  }, [draft, dirty, jsonDirty]);

  useEffect(() => {
    setTrainingStepsInput(String(draft.training_steps));
  }, [draft.training_steps]);

  if (!settings) {
    return <div className="text-sm text-[var(--fc-text-muted)]">Loading LoRA settings…</div>;
  }

  const saveAll = async () => {
    setSaveError(null);
    setJsonError(null);
    setSaving(true);
    try {
      const saved = await saveSettings({
        ...settings,
        training_defaults: draft as unknown as Record<string, unknown>,
        auto_steps_from_images: autoStepsFromImages,
        steps_per_image: Math.max(1, Math.round(stepsPerImage)),
        min_auto_steps: Math.max(1, Math.round(minAutoSteps)),
        max_auto_steps: Math.max(Math.max(1, Math.round(minAutoSteps)), Math.round(maxAutoSteps)),
      });
      if (!saved) {
        setSaveError("Could not save LoRA settings.");
        return;
      }
      setDirty(false);
      setJsonDirty(false);
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setSaveError(null);
    setJsonError(null);
    setJsonDirty(false);
    setDirty(false);
    setDraft(liveDefaults);
    setTrainingStepsInput(String(liveDefaults.training_steps));
    setAutoStepsFromImages(Boolean(settings.auto_steps_from_images));
    setStepsPerImage(Math.max(1, Math.round(settings.steps_per_image ?? 100)));
    setMinAutoSteps(Math.max(1, Math.round(settings.min_auto_steps ?? 100)));
    setMaxAutoSteps(Math.max(1, Math.round(settings.max_auto_steps ?? 6000)));
  };

  const dataset0 = draft.datasets[0] ?? DEFAULT_TRAINING_CONFIG.datasets[0]!;
  const repeats0 = clampInt(dataset0.num_repeats ?? 1, { min: 1, max: 1000 });
  const imagesNum = clampInt(numericValue(calcImages), { min: 0, max: 100000 });
  const epochsNum = clampInt(numericValue(calcEpochs), { min: 1, max: 10000 });
  const batchNum = clampInt(draft.batch_size, { min: 1, max: 512 });
  const gradAccNum = clampInt(draft.gradient_accumulation_steps, { min: 1, max: 512 });
  const suggestedSteps = stepsFromEpochs({ images: imagesNum, repeats: repeats0, epochs: epochsNum, batch: batchNum, gradAcc: gradAccNum });
  const approxEpochs = imagesNum > 0 ? epochsFromSteps({ steps: draft.training_steps, images: imagesNum, repeats: repeats0, batch: batchNum, gradAcc: gradAccNum }) : null;
  const autoPreviewSteps = Math.max(
    minAutoSteps,
    Math.min(
      maxAutoSteps,
      Math.ceil((imagesNum * repeats0 * Math.max(1, Math.round(stepsPerImage))) / Math.max(1, batchNum * gradAccNum)),
    ),
  );

  const presetFast = (base: TrainingConfig): TrainingConfig => {
    const dataset = base.datasets[0] ?? DEFAULT_TRAINING_CONFIG.datasets[0]!;
    return {
      ...base,
      training_steps: 600,
      rank: 16,
      alpha: 16,
      learning_rate: 0.0001,
      unet_lr: 0.0001,
      text_encoder_lr: 0.000005,
      save_every_n_steps: 200,
      save_last_n_steps: 2,
      sampling: {
        ...base.sampling,
        sample_every_n_steps: 200,
        sample_steps: 20,
      },
      datasets: [{ ...dataset, num_repeats: Math.max(1, Math.min(5, dataset.num_repeats || 1)) }, ...base.datasets.slice(1)],
    };
  };

  const presetStandard = (base: TrainingConfig): TrainingConfig => {
    const dataset = base.datasets[0] ?? DEFAULT_TRAINING_CONFIG.datasets[0]!;
    return {
      ...base,
      training_steps: 1200,
      rank: 32,
      alpha: 32,
      learning_rate: 0.0001,
      unet_lr: 0.0001,
      text_encoder_lr: 0.00001,
      save_every_n_steps: 250,
      save_last_n_steps: 4,
      sampling: {
        ...base.sampling,
        sample_every_n_steps: 250,
        sample_steps: 25,
      },
      datasets: [{ ...dataset, num_repeats: Math.max(1, Math.min(10, dataset.num_repeats || 1)) }, ...base.datasets.slice(1)],
    };
  };

  const presetHigh = (base: TrainingConfig): TrainingConfig => {
    const dataset = base.datasets[0] ?? DEFAULT_TRAINING_CONFIG.datasets[0]!;
    return {
      ...base,
      training_steps: 3500,
      rank: 64,
      alpha: 64,
      learning_rate: 0.0001,
      unet_lr: 0.0001,
      text_encoder_lr: 0.00001,
      save_every_n_steps: 350,
      save_last_n_steps: 6,
      sampling: {
        ...base.sampling,
        sample_every_n_steps: 350,
        sample_steps: 28,
      },
      datasets: [{ ...dataset, num_repeats: Math.max(1, Math.min(15, dataset.num_repeats || 1)) }, ...base.datasets.slice(1)],
    };
  };

  const presetMax = (base: TrainingConfig): TrainingConfig => {
    const dataset = base.datasets[0] ?? DEFAULT_TRAINING_CONFIG.datasets[0]!;
    return {
      ...base,
      training_steps: 6000,
      rank: 96,
      alpha: 96,
      learning_rate: 0.0001,
      unet_lr: 0.0001,
      text_encoder_lr: 0.00001,
      save_every_n_steps: 500,
      save_last_n_steps: 8,
      sampling: {
        ...base.sampling,
        sample_every_n_steps: 500,
        sample_steps: 30,
      },
      datasets: [{ ...dataset, num_repeats: Math.max(1, Math.min(20, dataset.num_repeats || 1)) }, ...base.datasets.slice(1)],
    };
  };

  return (
    <div className="space-y-4 font-sans">
      <div>
        <div className="text-sm font-semibold text-[var(--fc-text)]">LoRA defaults</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          These values become the default for every new LoRA run. Per-asset step overrides live in Assets.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Human terms</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          Think in <span className="font-semibold text-[var(--fc-text)]">epochs</span>, then convert to steps. Epochs = “how many times the dataset is seen”.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Quick glossary</div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[var(--fc-text-muted)]">
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Steps</span>: the number of optimizer updates. More steps = longer training.
              </div>
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Epochs</span>: dataset passes. Roughly{" "}
                <span className="font-semibold text-[var(--fc-text)]">epochs ≈ (steps × batch × grad-acc) ÷ (images × repeats)</span>.
              </div>
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Repeats</span> (`datasets[0].num_repeats`): extra weighting for your dataset. Higher repeats = more “exposure”.
              </div>
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Batch size</span>: images per step (per GPU). Higher batch = fewer steps for same epochs (but uses more VRAM).
              </div>
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Grad-acc</span>: accumulates multiple mini-batches before a step. Speeds/VRAM tradeoff similar to batch.
              </div>
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Rank / Alpha</span>: LoRA capacity. Higher = more detail + more time/VRAM.
              </div>
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Resolution</span>: biggest speed lever. Higher = much slower per step.
              </div>
              <div>
                <span className="font-semibold text-[var(--fc-text)]">Learning rate</span>: how big each step is. Too high can “break” training; too low needs more steps.
              </div>
            </div>

            <details className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-text-muted)]">
              <summary className="cursor-pointer select-none font-semibold text-[var(--fc-text)]">Field dictionary (expanded)</summary>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">mixed_precision</span>: faster + less VRAM; try `fp16` first, then `bf16` on newer GPUs.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">gradient_checkpointing</span>: saves VRAM, costs speed; usually worth it when memory-limited.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">cache_latents / cache_text_encoder_outputs</span>: precomputes features to speed training after an up-front cost.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">xformers / sdpa</span>: attention backends; one may be faster/more stable depending on GPU/driver.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">optimizer_type / optimizer_args</span>: Adam variants are common; 8bit variants save VRAM.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">scheduler / lr_warmup_steps</span>: shapes the LR over time; warmup helps stability in some runs.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">save_every_n_steps / save_last_n_steps</span>: checkpoint frequency + retention.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">bucket_settings</span>: enables variable aspect ratios without stretching; can improve quality but adds overhead.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">caption_dropout_rate / shuffle_caption / keep_tokens</span>: caption regularization; can reduce overfitting.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">color_aug / flip_aug / random_crop</span>: augmentations; can help generalization but can hurt identity fidelity.
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">sampling.*</span>: how often and how to generate preview images during training (can slow training).
                </div>
                <div>
                  <span className="font-semibold text-[var(--fc-text)]">flux_* / sd3_*</span>: model-family-specific knobs; leave defaults unless you know the architecture.
                </div>
              </div>
            </details>
          </div>

          <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Epoch calculator</div>
            <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
              Uses `images`, `repeats`, `batch`, and `grad-acc` to estimate steps/epochs. (Approximate, but good enough to pick sane defaults.)
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Images</div>
                <input
                  className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                  inputMode="numeric"
                  value={calcImages}
                  onChange={(e) => setCalcImages(e.currentTarget.value)}
                  placeholder="e.g. 12"
                />
              </label>
              <label className="block">
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Target epochs</div>
                <input
                  className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                  inputMode="numeric"
                  value={calcEpochs}
                  onChange={(e) => setCalcEpochs(e.currentTarget.value)}
                  placeholder="e.g. 8"
                />
              </label>
            </div>
            <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-3 text-sm text-[var(--fc-text-muted)]">
              <div>
                Repeats: <span className="font-semibold text-[var(--fc-text)]">{repeats0}</span> â€¢ Batch:{" "}
                <span className="font-semibold text-[var(--fc-text)]">{batchNum}</span> â€¢ Grad-acc:{" "}
                <span className="font-semibold text-[var(--fc-text)]">{gradAccNum}</span>
              </div>
              <div className="mt-1">
                Suggested steps: <span className="font-semibold text-[var(--fc-text)]">{suggestedSteps}</span>
                {approxEpochs !== null ? (
                  <>
                    {" "}
                    â€¢ Current steps ≈ <span className="font-semibold text-[var(--fc-text)]">{approxEpochs.toFixed(1)}</span> epochs
                  </>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
                disabled={imagesNum <= 0}
                onClick={() => {
                  setDraft((prev) => ({ ...prev, training_steps: suggestedSteps }));
                  setTrainingStepsInput(String(suggestedSteps));
                  setDirty(true);
                }}
              >
                Apply suggested steps
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                onClick={() => {
                  setCalcImages("20");
                  setCalcEpochs("10");
                }}
              >
                Reset calculator
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Training presets</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          One-click defaults. If you want faster training, start with Fast and only increase steps/rank if the model isnâ€™t sticking.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95"
            onClick={() => {
              setDraft((prev) => presetFast(prev));
              setDirty(true);
            }}
            title="Lower steps and capacity for speed."
          >
            Fast
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => {
              setDraft((prev) => presetStandard(prev));
              setDirty(true);
            }}
            title="Balanced defaults."
          >
            Medium
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => {
              setDraft((prev) => presetHigh(prev));
              setDirty(true);
            }}
            title="More detail; takes longer."
          >
            High
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => {
              setDraft((prev) => presetMax(prev));
              setDirty(true);
            }}
            title="Very slow; only use when you really need it."
          >
            Max
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text-muted)]">
          Speed levers: lower <span className="font-semibold text-[var(--fc-text)]">steps</span>, lower{" "}
          <span className="font-semibold text-[var(--fc-text)]">rank/alpha</span>, lower{" "}
          <span className="font-semibold text-[var(--fc-text)]">resolution</span>, increase{" "}
          <span className="font-semibold text-[var(--fc-text)]">batch</span> (if you have VRAM).
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Auto steps from images</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          Recommended baseline: <span className="font-semibold text-[var(--fc-text)]">~100 steps per image</span>. When enabled, new runs pick steps from your image count automatically.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 md:col-span-2">
            <input
              type="checkbox"
              checked={autoStepsFromImages}
              onChange={(e) => {
                setAutoStepsFromImages(e.currentTarget.checked);
                setDirty(true);
              }}
            />
            <span className="text-sm font-semibold text-[var(--fc-text)]">Enable auto steps</span>
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Steps / image</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(stepsPerImage)}
              onChange={(e) => {
                setStepsPerImage(numericValue(e.currentTarget.value) || 0);
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Min / Max</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                className="w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(minAutoSteps)}
                onChange={(e) => {
                  setMinAutoSteps(numericValue(e.currentTarget.value) || 0);
                  setDirty(true);
                }}
                placeholder="min"
              />
              <input
                className="w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(maxAutoSteps)}
                onChange={(e) => {
                  setMaxAutoSteps(numericValue(e.currentTarget.value) || 0);
                  setDirty(true);
                }}
                placeholder="max"
              />
            </div>
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-sm text-[var(--fc-text-muted)]">
          Preview (using the calculatorâ€™s image count):{" "}
          <span className="font-semibold text-[var(--fc-text)]">{autoPreviewSteps}</span> steps for{" "}
          <span className="font-semibold text-[var(--fc-text)]">{imagesNum}</span> images with repeats{" "}
          <span className="font-semibold text-[var(--fc-text)]">{repeats0}</span>.
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fc-text)]">Save changes</div>
            <div className="mt-1 text-sm text-[var(--fc-text-muted)]">
              {dirty || jsonDirty ? "You have unsaved changes." : "Everything is saved."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
              disabled={saving || !(dirty || jsonDirty)}
              onClick={() => void saveAll()}
            >
              {saving ? "Savingâ€¦" : "Save"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)] disabled:opacity-60"
              disabled={saving || !(dirty || jsonDirty)}
              onClick={discardChanges}
            >
              Discard
            </button>
          </div>
        </div>
        {saveError ? <div className="mt-3 text-sm text-[var(--fc-danger)]">{saveError}</div> : null}
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Core defaults</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">Use these for the fastest wins. Everything else is in the JSON editor below.</p>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          After you change steps or other run-critical defaults here, head back to Training and prepare a fresh run before hitting Train so the updates take effect.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Steps</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={trainingStepsInput}
              onChange={(e) => {
                setTrainingStepsInput(e.currentTarget.value);
                setDirty(true);
              }}
              onBlur={() => {
                const next = numericValue(trainingStepsInput);
                setDraft((prev) => ({ ...prev, training_steps: next }));
                setTrainingStepsInput(String(next));
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const next = numericValue(trainingStepsInput);
                setDraft((prev) => ({ ...prev, training_steps: next }));
                setTrainingStepsInput(String(next));
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Rank</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(draft.rank)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, rank: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Alpha</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(draft.alpha)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, alpha: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Batch size</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(draft.batch_size)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, batch_size: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Gradient accumulation</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(draft.gradient_accumulation_steps)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, gradient_accumulation_steps: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Resolution</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(draft.resolution)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, resolution: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Learning rate</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="decimal"
              value={String(draft.learning_rate)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, learning_rate: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">UNet LR</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="decimal"
              value={String(draft.unet_lr)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, unet_lr: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Text encoder LR</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="decimal"
              value={String(draft.text_encoder_lr)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, text_encoder_lr: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Optimizer</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              value={draft.optimizer_type}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, optimizer_type: e.currentTarget.value }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Scheduler</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              value={draft.scheduler}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, scheduler: e.currentTarget.value }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Mixed precision</div>
            <select
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              value={draft.mixed_precision}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, mixed_precision: e.currentTarget.value }));
                setDirty(true);
              }}
            >
              <option value="no">No</option>
              <option value="fp16">FP16</option>
              <option value="bf16">BF16</option>
            </select>
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Save every N steps</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(draft.save_every_n_steps)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, save_every_n_steps: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>

          <label className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3">
            <div className="text-xs font-medium text-[var(--fc-text-muted)]">Keep last N saves</div>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
              inputMode="numeric"
              value={String(draft.save_last_n_steps)}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, save_last_n_steps: numericValue(e.currentTarget.value) }));
                setDirty(true);
              }}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
        <div className="text-sm font-semibold text-[var(--fc-text)]">Full configuration (JSON)</div>
        <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
          Every training option is available here. Editing JSON is the only way to reach the full set of LoRA parameters.
        </p>
        <textarea
          className="mt-3 h-64 w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-3 text-xs text-[var(--fc-text)] outline-none focus:border-[var(--fc-border-strong)]"
          value={jsonDraft}
          onChange={(event) => {
            setJsonDirty(true);
            setJsonDraft(event.currentTarget.value);
          }}
        />
        {jsonError ? <div className="mt-2 text-sm text-[var(--fc-danger)]">{jsonError}</div> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[var(--fc-accent-text)] hover:opacity-95 disabled:opacity-60"
            disabled={!jsonDirty}
            onClick={async () => {
              try {
                const parsed = JSON.parse(jsonDraft);
                const next = coerceTrainingConfig(parsed);
                setDraft(next);
                setTrainingStepsInput(String(next.training_steps));
                setDirty(true);
                setJsonDirty(false);
              } catch (error) {
                setJsonError(`Invalid JSON: ${String(error)}`);
              }
            }}
          >
            Apply JSON
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
            onClick={() => {
              setDraft({ ...DEFAULT_TRAINING_CONFIG });
              setTrainingStepsInput(String(DEFAULT_TRAINING_CONFIG.training_steps));
              setDirty(true);
              setJsonDirty(false);
            }}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
