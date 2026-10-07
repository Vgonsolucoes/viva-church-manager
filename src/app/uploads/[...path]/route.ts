import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { resolveUploadsDir } from "@/server/uploads-dir";

export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Serve arquivos de /uploads/* a partir do diretório de uploads configurado
// (UPLOADS_DIR/volume persistente ou public/uploads como fallback).
// Garante que fotos continuem acessíveis em produção mesmo quando o volume
// fica fora de public/.
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await context.params;
    if (!segments?.length) {
      return new Response("Not found", { status: 404 });
    }

    const uploadsDir = path.normalize(resolveUploadsDir());
    const fullPath = path.normalize(path.join(uploadsDir, segments.join(path.sep)));

    // Proteção contra path traversal (ex: /uploads/..%2F..%2F.env)
    if (!fullPath.startsWith(uploadsDir + path.sep)) {
      return new Response("Not found", { status: 404 });
    }

    const contentType = contentTypes[path.extname(fullPath).toLowerCase()];
    if (!contentType) {
      return new Response("Not found", { status: 404 });
    }

    const fileStat = await stat(fullPath).catch(() => null);
    if (!fileStat?.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const stream = Readable.toWeb(createReadStream(fullPath)) as ReadableStream;
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        // Nomes de arquivo são únicos (timestamp + random), cache imutável é seguro.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[uploads] GET /uploads falhou:", err);
    return new Response("Not found", { status: 404 });
  }
}
