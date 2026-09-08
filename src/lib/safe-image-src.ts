export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function safeImageSrcOrUndefined(value: unknown): string | undefined {
  const s = safeImageSrc(value);
  return s ?? undefined;
}
