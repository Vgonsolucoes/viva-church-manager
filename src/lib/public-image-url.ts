/** Resolve uploaded artwork against the public proxy host, not Next's internal origin. */
export function publicImageUrl(value: string | null | undefined, request: Request): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const internal = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? internal.host).split(",")[0].trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol === "https" || forwardedProtocol === "http" ? forwardedProtocol : internal.protocol.slice(0, -1);
  return new URL(value, `${protocol}://${host}`).toString();
}
