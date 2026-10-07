import path from "path";

const PUBLIC_UPLOADS_FALLBACK = path.join("public", "uploads");

export function resolveUploadsDir(): string {
  const envDir = process.env.UPLOADS_DIR?.trim();
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.join(process.cwd(), envDir);
  }
  return path.join(process.cwd(), PUBLIC_UPLOADS_FALLBACK);
}
