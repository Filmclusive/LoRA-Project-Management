import type { TrainingConfig } from "../../state/trainingConfig";

export function AdvancedSettingsPanel(props: {
  value: TrainingConfig;
  onChange: (next: TrainingConfig) => void;
}) {
  const v = props.value;

  const updateDataset = (index: number, patch: Partial<TrainingConfig["datasets"][number]>) => {
    const next = v.datasets.map((dataset, i) => (i === index ? { ...dataset, ...patch } : dataset));
    props.onChange({ ...v, datasets: next });
  };

  const removeDataset = (index: number) => {
    const next = v.datasets.filter((_, i) => i !== index);
    props.onChange({ ...v, datasets: next.length ? next : v.datasets });
  };

  const addDataset = () => {
    const base = v.datasets[0];
    props.onChange({ ...v, datasets: [...v.datasets, { ...base, image_dir: "" }] });
  };

  const updatePrompt = (index: number, patch: Partial<TrainingConfig["sampling"]["prompts"][number]>) => {
    const next = v.sampling.prompts.map((prompt, i) => (i === index ? { ...prompt, ...patch } : prompt));
    props.onChange({ ...v, sampling: { ...v.sampling, prompts: next } });
  };

  const removePrompt = (index: number) => {
    const next = v.sampling.prompts.filter((_, i) => i !== index);
    props.onChange({ ...v, sampling: { ...v.sampling, prompts: next.length ? next : v.sampling.prompts } });
  };

  const addPrompt = () => {
    props.onChange({ ...v, sampling: { ...v.sampling, prompts: [...v.sampling.prompts, { prompt: "" }] } });
  };

  const RESOLUTION_CHOICES = [256, 512, 768, 1024, 1280, 1536];

  return (
    <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4 font-sans">
      <div className="text-sm font-semibold text-[var(--fc-text)]">Advanced training settings</div>
      <p className="mt-1 text-sm text-[var(--fc-text-muted)]">
        Use these when you need custom trainers, different model families (for example Wan 2.2), or fine control over sampling.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 md:col-span-2">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Job</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Training name</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.run_label}
                onChange={(e) => props.onChange({ ...v, run_label: e.currentTarget.value })}
                placeholder="Optional run label"
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">GPU ID</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.gpu_id}
                onChange={(e) => props.onChange({ ...v, gpu_id: e.currentTarget.value })}
                placeholder="GPU #0"
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Trigger word</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.trigger_word}
                onChange={(e) => props.onChange({ ...v, trigger_word: e.currentTarget.value })}
                placeholder="token"
              />
            </label>

            <label className="md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Trainer engine</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.engine}
                onChange={(e) => props.onChange({ ...v, engine: e.currentTarget.value })}
              >
                <option value="auto">Auto</option>
                <option value="kohya">Built-in</option>
                <option value="adapter">External trainer (adapter)</option>
              </select>
              <div className="mt-2 text-xs text-[var(--fc-text-muted)]">
                Auto uses the selected asset’s model family. Use adapter for trainers like AI Toolkit.
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 md:col-span-2">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Model</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Model architecture</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.model_architecture || ""}
                onChange={(e) => props.onChange({ ...v, model_architecture: e.currentTarget.value })}
              >
                <option value="">Auto (asset family)</option>
                <option value="sdxl">SDXL</option>
                <option value="flux">FLUX</option>
                <option value="sd3">SD3</option>
                <option value="lumina">Lumina</option>
                <option value="hunyuan">Hunyuan</option>
                <option value="anima">Anima</option>
                <option value="wan2.1-14b">Wan 2.1 (14B)</option>
                <option value="wan2.2-14b">Wan 2.2 (14B)</option>
              </select>
            </label>

            <label className="md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Name or path</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)] placeholder:text-[var(--fc-text-faint)]"
                value={v.model_name_or_path}
                onChange={(e) => props.onChange({ ...v, model_name_or_path: e.currentTarget.value })}
                placeholder="Model ID or local path"
              />
            </label>

            <label className="md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Quantization (transformer)</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.quantization_transformer}
                onChange={(e) => props.onChange({ ...v, quantization_transformer: e.currentTarget.value })}
              >
                <option value="float8">float8 (default)</option>
                <option value="bf16">bf16</option>
                <option value="fp16">fp16</option>
                <option value="fp32">fp32</option>
              </select>
            </label>

            <label className="md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Quantization (text encoder)</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.quantization_text_encoder}
                onChange={(e) => props.onChange({ ...v, quantization_text_encoder: e.currentTarget.value })}
              >
                <option value="float8">float8 (default)</option>
                <option value="bf16">bf16</option>
                <option value="fp16">fp16</option>
                <option value="fp32">fp32</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Low VRAM</div>
                <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Lets your external trainer pick a memory-saving mode.</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.low_vram}
                onChange={(e) => props.onChange({ ...v, low_vram: e.currentTarget.checked })}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 md:col-span-2">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Target + save</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Target type</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.target_type}
                onChange={(e) => props.onChange({ ...v, target_type: e.currentTarget.value })}
              >
                <option value="lora">LoRA</option>
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Linear rank</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.rank)}
                onChange={(e) => props.onChange({ ...v, rank: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Alpha</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.alpha)}
                onChange={(e) => props.onChange({ ...v, alpha: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Save data type</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.save_precision || "bf16"}
                onChange={(e) => props.onChange({ ...v, save_precision: e.currentTarget.value })}
              >
                <option value="bf16">BF16</option>
                <option value="fp16">FP16</option>
                <option value="fp32">FP32</option>
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Save every</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.save_every_n_steps)}
                onChange={(e) => props.onChange({ ...v, save_every_n_steps: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Max saves to keep</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.save_last_n_steps)}
                onChange={(e) => props.onChange({ ...v, save_last_n_steps: Number(e.currentTarget.value || 0) })}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 md:col-span-2">
          <div className="text-xs font-medium text-[var(--fc-text-muted)]">Training</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Batch size</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.batch_size)}
                onChange={(e) => props.onChange({ ...v, batch_size: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Gradient accumulation</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.gradient_accumulation_steps)}
                onChange={(e) => props.onChange({ ...v, gradient_accumulation_steps: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Steps</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.training_steps)}
                onChange={(e) => props.onChange({ ...v, training_steps: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Optimizer</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.optimizer_type}
                onChange={(e) => props.onChange({ ...v, optimizer_type: e.currentTarget.value })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Learning rate</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="decimal"
                value={String(v.learning_rate)}
                onChange={(e) => props.onChange({ ...v, learning_rate: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Weight decay</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="decimal"
                value={String(v.weight_decay)}
                onChange={(e) => props.onChange({ ...v, weight_decay: Number(e.currentTarget.value || 0) })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Timestep type</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.timestep_type}
                onChange={(e) => props.onChange({ ...v, timestep_type: e.currentTarget.value })}
              >
                <option value="sigmoid">Sigmoid</option>
                <option value="uniform">Uniform</option>
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Timestep bias</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.timestep_bias}
                onChange={(e) => props.onChange({ ...v, timestep_bias: e.currentTarget.value })}
              >
                <option value="balanced">Balanced</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Loss type</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.loss_type}
                onChange={(e) => props.onChange({ ...v, loss_type: e.currentTarget.value })}
              >
                <option value="mse">Mean squared error</option>
                <option value="huber">Huber</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Use EMA</div>
                <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Exponential moving average of weights.</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.use_ema}
                onChange={(e) => props.onChange({ ...v, use_ema: e.currentTarget.checked })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Unload text encoder</div>
                <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Lets trainers free VRAM after caching.</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.unload_text_encoder}
                onChange={(e) => props.onChange({ ...v, unload_text_encoder: e.currentTarget.checked })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Cache text embeddings</div>
                <div className="mt-1 text-xs text-[var(--fc-text-muted)]">External trainers can reuse embeddings across steps.</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.cache_text_embeddings}
                onChange={(e) => props.onChange({ ...v, cache_text_embeddings: e.currentTarget.checked })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div>
                <div className="text-xs font-medium text-[var(--fc-text-muted)]">Differential output preservation</div>
                <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Regularization option for some trainers.</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.differential_output_preservation}
                onChange={(e) => props.onChange({ ...v, differential_output_preservation: e.currentTarget.checked })}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Datasets</div>
              <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Use one dataset for most LoRAs. Add more for mixing.</div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
              onClick={addDataset}
            >
              Add dataset
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {v.datasets.map((dataset, index) => (
              <div key={index} className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--fc-text)]">Dataset {index + 1}</div>
                  {v.datasets.length > 1 ? (
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-danger)] hover:bg-[var(--fc-surface-hover)]"
                      onClick={() => removeDataset(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label>
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">LoRA weight</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)]"
                      inputMode="decimal"
                      value={String(dataset.lora_weight)}
                      onChange={(e) => updateDataset(index, { lora_weight: Number(e.currentTarget.value || 0) })}
                    />
                  </label>

                  <label>
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Caption dropout rate</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)]"
                      inputMode="decimal"
                      value={String(dataset.caption_dropout_rate)}
                      onChange={(e) => updateDataset(index, { caption_dropout_rate: Number(e.currentTarget.value || 0) })}
                    />
                  </label>

                  <label>
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Num frames</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)]"
                      inputMode="numeric"
                      value={String(dataset.num_frames)}
                      onChange={(e) => updateDataset(index, { num_frames: Number(e.currentTarget.value || 0) })}
                    />
                  </label>

                  <label>
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Repeats</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)]"
                      inputMode="numeric"
                      value={String(dataset.num_repeats)}
                      onChange={(e) => updateDataset(index, { num_repeats: Number(e.currentTarget.value || 0) })}
                    />
                  </label>

                  <label className="md:col-span-2">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Default caption</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)] placeholder:text-[var(--fc-text-faint)]"
                      value={dataset.default_caption}
                      onChange={(e) => updateDataset(index, { default_caption: e.currentTarget.value })}
                      placeholder="Used when an image has no caption"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Class tokens</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-2 text-sm text-[var(--fc-text)]"
                      value={dataset.class_tokens}
                      onChange={(e) => updateDataset(index, { class_tokens: e.currentTarget.value })}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-3">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Cache latents</div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={dataset.cache_latents}
                      onChange={(e) => updateDataset(index, { cache_latents: e.currentTarget.checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-3">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Regularization</div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={dataset.is_reg}
                      onChange={(e) => updateDataset(index, { is_reg: e.currentTarget.checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-3">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Flip X</div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={dataset.flip_x}
                      onChange={(e) => updateDataset(index, { flip_x: e.currentTarget.checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-3">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Flip Y</div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={dataset.flip_y}
                      onChange={(e) => updateDataset(index, { flip_y: e.currentTarget.checked })}
                    />
                  </label>

                  <div className="md:col-span-4">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Resolutions</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {RESOLUTION_CHOICES.map((reso) => {
                        const active = dataset.resolutions.includes(reso);
                        return (
                          <button
                            key={reso}
                            type="button"
                            className={[
                              "rounded-xl border px-3 py-2 text-sm font-semibold",
                              active
                                ? "border-[var(--fc-border-strong)] bg-[var(--fc-surface)] text-[var(--fc-text)]"
                                : "border-[var(--fc-border)] bg-[var(--fc-panel)] text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text)]",
                            ].join(" ")}
                            onClick={() => {
                              const next = active
                                ? dataset.resolutions.filter((x) => x !== reso)
                                : [...dataset.resolutions, reso].sort((a, b) => a - b);
                              updateDataset(index, { resolutions: next.length ? next : dataset.resolutions });
                            }}
                          >
                            {reso}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Sampling</div>
              <div className="mt-1 text-xs text-[var(--fc-text-muted)]">Keeps a few preview generations during training.</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Disable sampling</div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.sampling.disable_sampling}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, disable_sampling: e.currentTarget.checked } })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Sample every</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.sampling.sample_every_n_steps)}
                onChange={(e) =>
                  props.onChange({ ...v, sampling: { ...v.sampling, sample_every_n_steps: Number(e.currentTarget.value || 0) } })
                }
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Sampler</div>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                value={v.sampling.sample_sampler}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, sample_sampler: e.currentTarget.value } })}
              >
                <option value="flowmatch">FlowMatch</option>
                <option value="euler_a">Euler A</option>
                <option value="euler">Euler</option>
                <option value="dpmpp_2m">DPM++ 2M</option>
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Width</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.sampling.width)}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, width: Number(e.currentTarget.value || 0) } })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Height</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.sampling.height)}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, height: Number(e.currentTarget.value || 0) } })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Seed</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.sampling.seed)}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, seed: Number(e.currentTarget.value || 0) } })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Walk seed</div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.sampling.walk_seed}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, walk_seed: e.currentTarget.checked } })}
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Guidance scale</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="decimal"
                value={String(v.sampling.guidance_scale)}
                onChange={(e) =>
                  props.onChange({ ...v, sampling: { ...v.sampling, guidance_scale: Number(e.currentTarget.value || 0) } })
                }
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Sample steps</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.sampling.sample_steps)}
                onChange={(e) =>
                  props.onChange({ ...v, sampling: { ...v.sampling, sample_steps: Number(e.currentTarget.value || 0) } })
                }
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Num frames</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.sampling.num_frames)}
                onChange={(e) =>
                  props.onChange({ ...v, sampling: { ...v.sampling, num_frames: Number(e.currentTarget.value || 0) } })
                }
              />
            </label>

            <label>
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">FPS</div>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                inputMode="numeric"
                value={String(v.sampling.fps)}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, fps: Number(e.currentTarget.value || 0) } })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Skip first sample</div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.sampling.skip_first_sample}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, skip_first_sample: e.currentTarget.checked } })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-3 md:col-span-2">
              <div className="text-xs font-medium text-[var(--fc-text-muted)]">Force first sample</div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.sampling.sample_at_first}
                onChange={(e) => props.onChange({ ...v, sampling: { ...v.sampling, sample_at_first: e.currentTarget.checked } })}
              />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--fc-text)]">Sample prompts</div>
              <button
                type="button"
                className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm font-semibold text-[var(--fc-text)] hover:bg-[var(--fc-surface-hover)]"
                onClick={addPrompt}
              >
                Add prompt
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {v.sampling.prompts.map((prompt, index) => (
                <div key={index} className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-[var(--fc-text-muted)]">Prompt {index + 1}</div>
                    {v.sampling.prompts.length > 1 ? (
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-panel)] px-3 py-2 text-sm font-semibold text-[var(--fc-danger)] hover:bg-[var(--fc-surface-hover)]"
                        onClick={() => removePrompt(index)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <input
                    className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)] placeholder:text-[var(--fc-text-faint)]"
                    value={prompt.prompt}
                    onChange={(e) => updatePrompt(index, { prompt: e.currentTarget.value })}
                    placeholder="Include your trigger word for best results"
                  />

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <label>
                      <div className="text-xs font-medium text-[var(--fc-text-muted)]">Width</div>
                      <input
                        className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                        inputMode="numeric"
                        value={String(prompt.width ?? "")}
                        onChange={(e) => updatePrompt(index, { width: Number(e.currentTarget.value || 0) })}
                        placeholder={String(v.sampling.width)}
                      />
                    </label>
                    <label>
                      <div className="text-xs font-medium text-[var(--fc-text-muted)]">Height</div>
                      <input
                        className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                        inputMode="numeric"
                        value={String(prompt.height ?? "")}
                        onChange={(e) => updatePrompt(index, { height: Number(e.currentTarget.value || 0) })}
                        placeholder={String(v.sampling.height)}
                      />
                    </label>
                    <label>
                      <div className="text-xs font-medium text-[var(--fc-text-muted)]">Seed</div>
                      <input
                        className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                        inputMode="numeric"
                        value={String(prompt.seed ?? "")}
                        onChange={(e) => updatePrompt(index, { seed: Number(e.currentTarget.value || 0) })}
                        placeholder={String(v.sampling.seed)}
                      />
                    </label>
                    <label>
                      <div className="text-xs font-medium text-[var(--fc-text-muted)]">LoRA scale</div>
                      <input
                        className="mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-panel)] px-2 py-2 text-sm text-[var(--fc-text)]"
                        inputMode="decimal"
                        value={String(prompt.lora_scale ?? "")}
                        onChange={(e) => updatePrompt(index, { lora_scale: Number(e.currentTarget.value || 0) })}
                        placeholder={String(v.sampling.lora_scale)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
