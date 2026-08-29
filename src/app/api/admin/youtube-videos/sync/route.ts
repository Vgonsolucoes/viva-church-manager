import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { hasPermission } from "@/server/rbac";
import { prisma } from "@/server/db";
import { fetchChannelVideos } from "@/server/youtube";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as Parameters<typeof hasPermission>[0];
  if (!hasPermission(roles, "youtube:write")) {
    return NextResponse.json({ ok: false, error: "Permissao insuficiente." }, { status: 403 });
  }

  try {
    const videos = await fetchChannelVideos({ maxResults: 200 });
    if (!videos.length) {
      return NextResponse.json({
        ok: false,
        error:
          "Nenhum video retornado. Verifique YOUTUBE_CHANNEL_ID ou YOUTUBE_API_KEY + YOUTUBE_CHANNEL_HANDLE.",
      });
    }

    let imported = 0;
    let updated = 0;

    for (const v of videos) {
      const existing = await prisma.youtubeVideo.findUnique({
        where: { youtubeId: v.youtubeId },
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          publishedAt: true,
          duration: true,
          viewCount: true,
        },
      });

      if (!existing) {
        await prisma.youtubeVideo.create({
          data: {
            youtubeId: v.youtubeId,
            title: v.title,
            description: v.description ?? null,
            thumbnailUrl: v.thumbnailUrl ?? null,
            publishedAt: v.publishedAt,
            duration: v.duration ?? null,
            viewCount: v.viewCount ?? 0,
            syncStatus: "SYNCED",
            syncedById: session?.uid ?? null,
          },
        });
        imported += 1;
      } else {
        const newViewCount =
          (v.viewCount !== undefined && v.viewCount !== null ? v.viewCount : null) ??
          (existing.viewCount ?? 0);

        const changed =
          existing.title !== v.title ||
          (existing.description ?? "") !== (v.description ?? "") ||
          (existing.thumbnailUrl ?? "") !== (v.thumbnailUrl ?? "") ||
          existing.publishedAt.getTime() !== new Date(v.publishedAt).getTime() ||
          (existing.duration ?? "") !== (v.duration ?? "") ||
          (existing.viewCount ?? 0) !== newViewCount;

        if (changed) {
          await prisma.youtubeVideo.update({
            where: { id: existing.id },
            data: {
              title: v.title,
              description: v.description ?? null,
              thumbnailUrl: v.thumbnailUrl ?? null,
              publishedAt: v.publishedAt,
              duration: v.duration ?? null,
              viewCount: newViewCount,
              syncStatus: "SYNCED",
              syncedById: session?.uid ?? null,
            },
          });
          updated += 1;
        }
      }
    }

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
