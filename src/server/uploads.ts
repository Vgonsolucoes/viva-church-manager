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

async function saveUploadedFile(file: File, prefix: string, maxBytes: number) {
  try {
    if (!file) return null;
    if (typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function") return null;

    const size = (file as { size?: unknown }).size;
    const type = (file as { type?: unknown }).type;
    if (typeof size !== "number" || size <= 0) return null;
    if (size > maxBytes) return null;
    if (typeof type !== "string") return null;

    const ext = allowedMimeToExt[type];
    if (!ext) return null;

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    if (!buffer.length) return null;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const name = `${prefix}_${Date.now()}_${crypto.randomBytes(10).toString("hex")}.${ext}`;
    const fullPath = path.join(uploadsDir, name);
    await writeFile(fullPath, buffer);

    return `/uploads/${name}`;
  } catch (err) {
    console.error("[uploads] Falha ao salvar arquivo:", err);
    return null;
  }
}

export async function savePublicImageUpload(file: File) {
  return saveUploadedFile(file, "banner", MAX_IMAGE_BYTES);
}

export async function saveMemberAvatarUpload(file: File) {
  return saveUploadedFile(file, "avatar", MAX_AVATAR_BYTES);
}
