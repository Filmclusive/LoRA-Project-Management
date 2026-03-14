export function splitPathSegments(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((part: string) => part.trim())
    .filter(Boolean);
}

export function fileNameFromPath(value: string) {
  const segments = splitPathSegments(value);
  return segments.length ? segments[segments.length - 1]! : value;
}

export function parentDir(value: string) {
  const segments = splitPathSegments(value);
  if (segments.length <= 1) return "";
  return segments.slice(0, -1).join("/");
}

export function deriveFluxDownloadRoot(selectedFolder: string) {
  const normalized = selectedFolder.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = splitPathSegments(normalized);
  const leaf = segments[segments.length - 1] ?? "";
  if (leaf === "FLUX.1-schnell") {
    const fluxDir = parentDir(normalized);
    return parentDir(fluxDir);
  }
  if (leaf === "flux") {
    return parentDir(normalized);
  }
  return normalized;
}

export type FluxProblemSummary = {
  missing: string[];
  corrupted: string[];
  otherCount: number;
};

export type FluxFileState = "missing" | "corrupted" | null;

export function fluxFileState(problems: string[], path: string): FluxFileState {
  for (const problem of problems) {
    if (!problem.includes(path)) continue;
    if (problem.startsWith("Missing file:")) return "missing";
    if (problem.startsWith("Unexpected size for")) return "corrupted";
    if (problem.startsWith("Checksum mismatch for")) return "corrupted";
  }
  return null;
}

export function summarizeFluxProblems(problems: string[], knownPaths: string[]) {
  const missing: string[] = [];
  const corrupted: string[] = [];
  let otherCount = 0;

  for (const problem of problems) {
    const missingMatch = /^Missing file:\s*(.+)$/.exec(problem);
    if (missingMatch?.[1]) {
      missing.push(fileNameFromPath(missingMatch[1]));
      continue;
    }
    const sizeMatch = /^Unexpected size for\s*(.+)$/.exec(problem);
    if (sizeMatch?.[1]) {
      corrupted.push(fileNameFromPath(sizeMatch[1]));
      continue;
    }
    const checksumMatch = /^Checksum mismatch for\s*(.+)$/.exec(problem);
    if (checksumMatch?.[1]) {
      corrupted.push(fileNameFromPath(checksumMatch[1]));
      continue;
    }
    const matchedKnown = knownPaths.find((path) => problem.includes(path));
    if (matchedKnown) {
      const name = fileNameFromPath(matchedKnown);
      if (/missing/i.test(problem)) missing.push(name);
      else corrupted.push(name);
      continue;
    }
    otherCount += 1;
  }

  return {
    missing: Array.from(new Set(missing)).sort((a, b) => a.localeCompare(b)),
    corrupted: Array.from(new Set(corrupted)).sort((a, b) => a.localeCompare(b)),
    otherCount,
  } satisfies FluxProblemSummary;
}
