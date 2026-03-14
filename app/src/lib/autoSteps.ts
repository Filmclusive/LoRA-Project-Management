export function computeAutoTrainingSteps(args: {
  imageCount: number;
  repeats: number;
  stepsPerImage: number;
  batchSize: number;
  gradAcc: number;
  minSteps: number;
  maxSteps: number;
}): number {
  const images = Math.max(0, Math.round(args.imageCount));
  const repeats = Math.max(1, Math.round(args.repeats));
  const stepsPerImage = Math.max(1, Math.round(args.stepsPerImage));
  const denom = Math.max(1, Math.round(args.batchSize) * Math.max(1, Math.round(args.gradAcc)));
  const raw = Math.ceil((images * repeats * stepsPerImage) / denom);
  const minSteps = Math.max(1, Math.round(args.minSteps));
  const maxSteps = Math.max(minSteps, Math.round(args.maxSteps));
  return Math.max(minSteps, Math.min(maxSteps, Math.max(1, raw)));
}

