"use server";

import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const allowedMimeToExt: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function savePublicImageUpload(file: File) {
  if (!file) return null;
  if (typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function") return null;

  const size = (file as { size?: unknown }).size;
  const type = (file as { type?: unknown }).type;
  if (typeof size !== "number" || size <= 0) return null;
  if (size > MAX_IMAGE_BYTES) return null;
  if (typeof type !== "string") return null;

  const ext = allowedMimeToExt[type];
  if (!ext) return null;

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const name = `banner_${Date.now()}_${crypto.randomBytes(10).toString("hex")}.${ext}`;
  const fullPath = path.join(uploadsDir, name);
  await writeFile(fullPath, buffer);

  return `/uploads/${name}`;
}
