import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { hasPermission } from "@/server/rbac";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  visibleOnSite: z.boolean(),
});

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as Parameters<typeof hasPermission>[0];
  if (!hasPermission(roles, "youtube:write")) {
    return NextResponse.json({ ok: false, error: "Permissao insuficiente." }, { status: 403 });
  }

  const params = await props.params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Corpo invalido." }, { status: 400 });
  }

  const existing = await prisma.youtubeVideo.findUnique({
    where: { id: params.id },
    select: { id: true, youtubeId: true, title: true, visibleOnSite: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Video nao encontrado." }, { status: 404 });
  }

  const updated = await prisma.youtubeVideo.update({
    where: { id: existing.id },
    data: { visibleOnSite: parsed.data.visibleOnSite },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: parsed.data.visibleOnSite ? "YOUTUBE_SHOW_ON_SITE" : "YOUTUBE_HIDE_ON_SITE",
    entityType: "YoutubeVideo",
    entityId: existing.id,
    before: { visibleOnSite: existing.visibleOnSite },
    after: { visibleOnSite: updated.visibleOnSite, youtubeId: existing.youtubeId, title: existing.title },
  });

  return NextResponse.json({ ok: true, visibleOnSite: updated.visibleOnSite });
}
