type FilmclusiveErrorPayload = {
  code?: string;
  message?: string;
  details?: string | null;
  next_steps?: string[] | null;
};

export function parseFilmclusiveError(
  raw: string,
): { code?: string; message: string; details?: string | null; nextSteps: string[] } | null {
  const trimmed = raw.trim();
  const marker = "FILMCLUSIVE_ERROR:";
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  const json = trimmed.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(json) as FilmclusiveErrorPayload;
    const code = typeof parsed.code === "string" && parsed.code.trim() ? parsed.code.trim() : undefined;
    const message = String(parsed.message || "Something went wrong.").trim();
    const nextSteps = Array.isArray(parsed.next_steps) ? parsed.next_steps.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()) : [];
    const details = typeof parsed.details === "string" ? parsed.details : null;
    return { code, message, details, nextSteps };
  } catch {
    return { message: trimmed, details: null, nextSteps: [] };
  }
}

export function formatErrorMessage(error: unknown): string {
  const raw = typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
  const parsed = parseFilmclusiveError(raw);
  if (!parsed) return raw.trim();
  const steps = parsed.nextSteps.slice(0, 3);
  return steps.length ? `${parsed.message} ${steps.join(" ")}` : parsed.message;
}

function truncate(value: string, maxLen: number) {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}\n…(truncated, ${value.length} chars total)`;
}

export function stringifyUnknownError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const message = error.message || String(error);
    const stack = typeof error.stack === "string" && error.stack.trim() ? error.stack.trim() : "";
    return stack && !stack.includes(message) ? `${message}\n${stack}` : stack || message;
  }

  if (error && typeof error === "object") {
    const anyErr = error as { message?: unknown; name?: unknown; toString?: unknown };
    const message = typeof anyErr.message === "string" ? anyErr.message : "";
    const name = typeof anyErr.name === "string" ? anyErr.name : "";
    const header = [name, message].filter(Boolean).join(": ").trim();
    try {
      const json = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      const combined = header ? `${header}\n${json}` : json;
      return truncate(combined, 20_000);
    } catch {
      const fallback = header || String(error);
      return truncate(fallback, 20_000);
    }
  }

  return truncate(String(error), 20_000);
}
