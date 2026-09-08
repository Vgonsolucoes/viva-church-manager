"use server";

import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const allowedMimeToExt: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PUBLIC_UPLOADS_FALLBACK = path.join("public", "uploads");

function resolveUploadsDir(): string {
  const envDir = process.env.UPLOADS_DIR?.trim();
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.join(process.cwd(), envDir);
  }
  return path.join(process.cwd(), PUBLIC_UPLOADS_FALLBACK);
}

async function saveUploadedFile(
  file: File,
  prefix: string,
  maxBytes: number,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    if (!file) return { ok: false, error: "Arquivo não informado." };
    if (typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function")
      return { ok: false, error: "Arquivo inválido (sem arrayBuffer)." };

    const size = (file as { size?: unknown }).size;
    const type = (file as { type?: unknown }).type;
    if (typeof size !== "number" || size <= 0)
      return { ok: false, error: "Arquivo vazio." };
    if (size > maxBytes)
      return {
        ok: false,
        error: `Arquivo muito grande (tamanho máximo permitido ${Math.round(
          maxBytes / 1024 / 1024,
        )}MB).`,
      };
    if (typeof type !== "string")
      return { ok: false, error: "Tipo do arquivo não informado." };

    const ext = allowedMimeToExt[type];
    if (!ext)
      return {
        ok: false,
        error: `Formato de arquivo não permitido (${type}). Aceitos: JPG, PNG, WEBP.`,
      };

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    if (!buffer.length) return { ok: false, error: "Arquivo não pôde ser lido." };

    const uploadsDir = resolveUploadsDir();
    await mkdir(uploadsDir, { recursive: true });

    const name = `${prefix}_${Date.now()}_${crypto
      .randomBytes(10)
      .toString("hex")}.${ext}`;
    const fullPath = path.join(uploadsDir, name);
    await writeFile(fullPath, buffer);

    if (process.env.UPLOADS_DIR) {
      return { ok: true, url: `/uploads/${name}` };
    }
    return { ok: true, url: `/uploads/${name}` };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err ?? "desconhecido");
    console.error("[uploads] Falha ao salvar arquivo:", err);
    return {
      ok: false,
      error: `Falha ao salvar arquivo (${message}). Verifique permissões de escrita na pasta de uploads.`,
    };
  }
}

export async function savePublicImageUpload(file: File) {
  const result = await saveUploadedFile(file, "banner", MAX_IMAGE_BYTES);
  return result.ok && result.url ? result.url : null;
}

export async function saveMemberAvatarUpload(file: File) {
  const result = await saveUploadedFile(file, "avatar", MAX_AVATAR_BYTES);
  return result.ok && result.url ? result.url : null;
}

export async function saveMemberAvatarUploadDetailed(file: File): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  const result = await saveUploadedFile(file, "avatar", MAX_AVATAR_BYTES);
  if (result.ok && result.url) return { ok: true, url: result.url };
  return { ok: false, error: result.error ?? "Falha ao salvar foto." };
}

