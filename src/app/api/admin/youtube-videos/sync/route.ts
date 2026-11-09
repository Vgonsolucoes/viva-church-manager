import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { hasPermission } from "@/server/rbac";
import { prisma } from "@/server/db";
import { syncYoutubeLibrary } from "@/server/youtube-library";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session?.permissions ?? [], "youtube:write")) {
    return NextResponse.json({ ok: false, error: "Permissao insuficiente." }, { status: 403 });
  }

  try {
    const result = await syncYoutubeLibrary({ manual: true, userId: session?.uid });
    if (!result) {
      return NextResponse.json({ ok: false, error: "Não foi possível consultar os vídeos do canal. Tente novamente em alguns minutos." }, { status: 502 });
    }
    const { imported, updated } = result;
    const total = await prisma.youtubeVideo.count();

    await logAudit({
      actorUserId: session?.uid ?? null,
      action: "SYNC_YOUTUBE",
      entityType: "YoutubeVideo",
      entityId: null,
      after: { imported, updated, total },
    });

    const items = await prisma.youtubeVideo.findMany({
      orderBy: { publishedAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      ok: true,
      imported,
      updated,
      total,
      items,
    });
  } catch (err) {
    console.error("[youtube-sync] Erro:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao sincronizar videos." },
      { status: 500 },
    );
  }
}
