import { NextRequest, NextResponse } from "next/server";
import { saveChildPhotoUploadDetailed } from "@/server/uploads";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const maxBodySize = "10mb";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireLoggedIn(req);
    if (!auth.ok) return auth.error;
    if (
      !hasPermission(auth.ctx.roles, "kids:checkin:self") &&
      !hasPermission(auth.ctx.roles, "kids:write")
    ) {
      const denied = requirePermission(auth.ctx, "kids:checkin:self");
      if (denied) return denied;
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Requisição inválida: esperado multipart/form-data." },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const rawFile = formData.get("photoFile");
    if (!rawFile || typeof (rawFile as File).arrayBuffer !== "function") {
      return NextResponse.json(
        { ok: false, error: "Arquivo 'photoFile' não enviado ou inválido." },
        { status: 400 },
      );
    }

    const file = rawFile as File;
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Formato não permitido (${file.type ?? "desconhecido"}). Aceitos: JPG, PNG, WEBP.`,
        },
        { status: 400 },
      );
    }
    if (file.size <= 0) {
      return NextResponse.json(
        { ok: false, error: "Arquivo vazio." },
        { status: 400 },
      );
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Arquivo muito grande. Tamanho máximo permitido: 2MB." },
        { status: 413 },
      );
    }

    const saved = await saveChildPhotoUploadDetailed(file);
    if (!saved.ok) {
      return NextResponse.json(
        { ok: false, error: saved.error ?? "Falha ao salvar foto." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, url: saved.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "desconhecido");
    console.error("[api/uploads/child-photo] POST falhou:", err);
    return NextResponse.json(
      {
        ok: false,
        error: `Erro interno ao salvar foto (${message}). Tente novamente ou contate suporte.`,
      },
      { status: 500 },
    );
  }
}
