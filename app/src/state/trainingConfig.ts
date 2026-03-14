import type { AppSettings, FluxModelInstallStatus } from "@filmclusive/orchestrator";

export type TrainingDatasetConfig = {
  image_dir?: string;
  num_repeats: number;
  is_reg: boolean;
  class_tokens: string;
  lora_weight: number;
  default_caption: string;
  caption_dropout_rate: number;
  cache_latents: boolean;
  flip_x: boolean;
  flip_y: boolean;
  resolutions: number[];
  num_frames: number;
};

export type SamplePromptConfig = {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  lora_scale?: number;
  guidance_scale?: number;
  sample_steps?: number;
  negative_prompt?: string;
};

export type SamplingConfig = {
  disable_sampling: boolean;
  sample_every_n_steps: number;
  sample_every_n_epochs: number;
  sample_at_first: boolean;
  skip_first_sample: boolean;
  sample_sampler: string;
  width: number;
  height: number;
  seed: number;
  walk_seed: boolean;
  guidance_scale: number;
  sample_steps: number;
  lora_scale: number;
  num_frames: number;
  fps: number;
  prompts: SamplePromptConfig[];
};

export type TrainingConfig = {
  engine: "auto" | "kohya" | "adapter" | string;
  run_label: string;
  model_architecture: string;
  model_name_or_path: string;
  trigger_word: string;
  gpu_id: string;
  low_vram: boolean;
  quantization_transformer: string;
  quantization_text_encoder: string;
  target_type: string;
  rank: number;
  alpha: number;
  network_dropout: number;
  network_train_unet_only: boolean;
  network_train_text_encoder_only: boolean;
  mixed_precision: "no" | "fp16" | "bf16" | string;
  full_fp16: boolean;
  full_bf16: boolean;
  fp8_base: boolean;
  fp8_base_unet: boolean;
  batch_size: number;
  gradient_accumulation_steps: number;
  training_steps: number;
  max_data_loader_n_workers: number;
  persistent_data_loader_workers: boolean;
  learning_rate: number;
  unet_lr: number;
  text_encoder_lr: number;
  optimizer_type: string;
  weight_decay: number;
  optimizer_args: string;
  timestep_type: string;
  timestep_bias: string;
  loss_type: string;
  use_ema: boolean;
  unload_text_encoder: boolean;
  cache_text_embeddings: boolean;
  differential_output_preservation: boolean;
  max_grad_norm: number;
  scheduler: string;
  lr_warmup_steps: number;
  lr_decay_steps: number;
  lr_scheduler_num_cycles: number;
  lr_scheduler_power: number;
  save_every_n_steps: number;
  save_last_n_steps: number;
  save_precision: string;
  save_model_as: string;
  save_state: boolean;
  save_state_on_train_end: boolean;
  resolution: number;
  bucket_settings: {
    enabled: boolean;
    min_reso: number;
    max_reso: number;
    reso_steps: number;
    no_upscale: boolean;
  };
  xformers: boolean;
  sdpa: boolean;
  gradient_checkpointing: boolean;
  cache_latents: boolean;
  cache_latents_to_disk: boolean;
  cache_text_encoder_outputs: boolean;
  cache_text_encoder_outputs_to_disk: boolean;
  fused_backward_pass: boolean;
  caption_extension: string;
  shuffle_caption: boolean;
  keep_tokens: number;
  caption_prefix: string;
  caption_suffix: string;
  caption_dropout_rate: number;
  caption_tag_dropout_rate: number;
  caption_dropout_every_n_epochs: number;
  color_aug: boolean;
  flip_aug: boolean;
  random_crop: boolean;
  blocks_to_swap: number;
  flux_clip_l: string;
  flux_t5xxl: string;
  flux_ae: string;
  flux_apply_t5_attn_mask: boolean;
  flux_guidance_scale: number;
  flux_timestep_sampling: string;
  flux_sigmoid_scale: number;
  flux_model_prediction_type: string;
  flux_discrete_flow_shift: number;
  flux_model_type: string;
  sd3_clip_l: string;
  sd3_clip_g: string;
  sd3_t5xxl: string;
  sd3_t5xxl_max_token_length: number;
  sd3_apply_lg_attn_mask: boolean;
  sd3_apply_t5_attn_mask: boolean;
  sd3_clip_l_dropout_rate: number;
  sd3_clip_g_dropout_rate: number;
  sd3_t5_dropout_rate: number;
  sd3_training_shift: number;
  sd3_pos_emb_random_crop_rate: number;
  sd3_enable_scaled_pos_embed: boolean;
  sampling: SamplingConfig;
  datasets: TrainingDatasetConfig[];
};

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  engine: "auto",
  run_label: "",
  model_architecture: "",
  model_name_or_path: "",
  trigger_word: "",
  gpu_id: "",
  low_vram: false,
  quantization_transformer: "float8",
  quantization_text_encoder: "float8",
  target_type: "lora",
  rank: 32,
  alpha: 32,
  network_dropout: 0,
  network_train_unet_only: false,
  network_train_text_encoder_only: false,
  mixed_precision: "fp16",
  full_fp16: false,
  full_bf16: false,
  fp8_base: false,
  fp8_base_unet: false,
  batch_size: 1,
  gradient_accumulation_steps: 1,
  training_steps: 2200,
  max_data_loader_n_workers: 2,
  persistent_data_loader_workers: false,
  learning_rate: 0.0001,
  unet_lr: 0.0001,
  text_encoder_lr: 0.00001,
  optimizer_type: "AdamW8bit",
  weight_decay: 0.01,
  optimizer_args: "",
  timestep_type: "sigmoid",
  timestep_bias: "balanced",
  loss_type: "mse",
  use_ema: false,
  unload_text_encoder: false,
  cache_text_embeddings: false,
  differential_output_preservation: false,
  max_grad_norm: 1.0,
  scheduler: "cosine",
  lr_warmup_steps: 0,
  lr_decay_steps: 0,
  lr_scheduler_num_cycles: 1,
  lr_scheduler_power: 1,
  save_every_n_steps: 250,
  save_last_n_steps: 4,
  save_precision: "",
  save_model_as: "safetensors",
  save_state: false,
  save_state_on_train_end: false,
  resolution: 1024,
  bucket_settings: {
    enabled: true,
    min_reso: 512,
    max_reso: 1024,
    reso_steps: 64,
    no_upscale: false,
  },
  xformers: true,
  sdpa: false,
  gradient_checkpointing: true,
  cache_latents: true,
  cache_latents_to_disk: false,
  cache_text_encoder_outputs: true,
  cache_text_encoder_outputs_to_disk: false,
  fused_backward_pass: false,
  caption_extension: ".txt",
  shuffle_caption: false,
  keep_tokens: 0,
  caption_prefix: "",
  caption_suffix: "",
  caption_dropout_rate: 0,
  caption_tag_dropout_rate: 0,
  caption_dropout_every_n_epochs: 0,
  color_aug: false,
  flip_aug: false,
  random_crop: false,
  blocks_to_swap: 0,
  flux_clip_l: "",
  flux_t5xxl: "",
  flux_ae: "",
  flux_apply_t5_attn_mask: true,
  flux_guidance_scale: 3.5,
  flux_timestep_sampling: "sigma",
  flux_sigmoid_scale: 1.0,
  flux_model_prediction_type: "sigma_scaled",
  flux_discrete_flow_shift: 3.0,
  flux_model_type: "flux",
  sd3_clip_l: "",
  sd3_clip_g: "",
  sd3_t5xxl: "",
  sd3_t5xxl_max_token_length: 256,
  sd3_apply_lg_attn_mask: false,
  sd3_apply_t5_attn_mask: true,
  sd3_clip_l_dropout_rate: 0,
  sd3_clip_g_dropout_rate: 0,
  sd3_t5_dropout_rate: 0,
  sd3_training_shift: 1.0,
  sd3_pos_emb_random_crop_rate: 0,
  sd3_enable_scaled_pos_embed: false,
  sampling: {
    disable_sampling: false,
    sample_every_n_steps: 250,
    sample_every_n_epochs: 0,
    sample_at_first: false,
    skip_first_sample: false,
    sample_sampler: "euler_a",
    width: 1024,
    height: 1024,
    seed: 42,
    walk_seed: true,
    guidance_scale: 4,
    sample_steps: 25,
    lora_scale: 1.0,
    num_frames: 1,
    fps: 16,
    prompts: [{ prompt: "portrait photo, cinematic lighting, detailed skin, 85mm lens", seed: 42 }],
  },
  datasets: [
    {
      num_repeats: 1,
      is_reg: false,
      class_tokens: "",
      lora_weight: 1.0,
      default_caption: "",
      caption_dropout_rate: 0.05,
      cache_latents: true,
      flip_x: false,
      flip_y: false,
      resolutions: [512, 768, 1024],
      num_frames: 1,
    },
  ],
};

export function coerceTrainingConfig(value: unknown): TrainingConfig {
  if (!value || typeof value !== "object") return { ...DEFAULT_TRAINING_CONFIG };
  const v = value as Partial<TrainingConfig>;
  return {
    ...DEFAULT_TRAINING_CONFIG,
    ...v,
    bucket_settings: {
      ...DEFAULT_TRAINING_CONFIG.bucket_settings,
      ...(v.bucket_settings ?? {}),
    },
    sampling: {
      ...DEFAULT_TRAINING_CONFIG.sampling,
      ...(v.sampling ?? {}),
      prompts:
        Array.isArray(v.sampling?.prompts) && v.sampling!.prompts.length > 0
          ? v.sampling!.prompts.map((p) => ({ ...DEFAULT_TRAINING_CONFIG.sampling.prompts[0], ...p }))
          : [...DEFAULT_TRAINING_CONFIG.sampling.prompts],
    },
    datasets:
      Array.isArray(v.datasets) && v.datasets.length > 0
        ? v.datasets.map((d) => ({ ...DEFAULT_TRAINING_CONFIG.datasets[0], ...d }))
        : [...DEFAULT_TRAINING_CONFIG.datasets],
  };
}

export function applyManagedFluxTrainingConfig(
  base: TrainingConfig,
  settings: AppSettings | null,
  fluxStatus: FluxModelInstallStatus | null,
): TrainingConfig {
  if (!settings || !fluxStatus?.ready || settings.preferred_flux_model_id !== "flux1-schnell") {
    return base;
  }
  return {
    ...base,
    model_architecture: "flux",
    model_name_or_path: fluxStatus.base_model_path,
    mixed_precision: base.mixed_precision || settings.mixed_precision || "fp16",
    gradient_checkpointing: true,
    cache_latents: true,
    cache_text_encoder_outputs: true,
    flux_clip_l: fluxStatus.clip_l_path,
    flux_t5xxl: fluxStatus.t5xxl_path,
    flux_ae: fluxStatus.ae_path,
    flux_guidance_scale: 1.0,
    flux_timestep_sampling: "flux_shift",
    flux_model_prediction_type: "raw",
    flux_model_type: "flux",
  };
}
