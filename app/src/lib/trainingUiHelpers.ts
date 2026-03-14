const KOHYA_ARCHITECTURES = new Set(["sd15", "sdxl", "flux", "sd3", "lumina", "hunyuan", "anima"]);

export function resolveTrainingEngineKey(args: {
  engineMode: string | null | undefined;
  modelArchitectureOverride: string | null | undefined;
  assetModelFamily: string | null | undefined;
}): string | null {
  const mode = String(args.engineMode || "auto")
    .trim()
    .toLowerCase();
  const override = String(args.modelArchitectureOverride || "")
    .trim()
    .toLowerCase();
  const family = String(args.assetModelFamily || "")
    .trim()
    .toLowerCase();

  const effectiveArch = override || family;
  if (!effectiveArch) return null;

  if (mode === "kohya") return "kohya";
  if (mode === "adapter") return `adapter:${effectiveArch}`;

  if (override && !KOHYA_ARCHITECTURES.has(override)) return `adapter:${override}`;
  if (effectiveArch && KOHYA_ARCHITECTURES.has(effectiveArch)) return "kohya";
  return `adapter:${effectiveArch}`;
}

export function ensureTriggerInPrompt(prompt: string, triggerWord: string): string {
  const t = (triggerWord || "").trim();
  const p = (prompt || "").trim();
  if (!t) return p;
  if (!p) return t;
  if (p.toLowerCase().includes(t.toLowerCase())) return p;
  return `${t}, ${p}`;
}

