export function decodeJwtPayload<T = Record<string, unknown>>(
  token: string,
): T | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return Math.floor(Date.now() / 1000) + bufferSeconds >= payload.exp;
}
