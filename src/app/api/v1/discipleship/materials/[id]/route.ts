import { NextResponse } from "next/server";
import { requireLoggedIn } from "@/server/session-helpers";
import { monthlyLeaderContext } from "@/server/discipleship-monthly";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const isSuperAdmin = auth.ctx.roles.includes("SUPER_ADMIN");
  const context = await monthlyLeaderContext(auth.ctx.member?.id);
  if (!isSuperAdmin && !context) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  const { id } = await params;
  const material = await prisma.discipleshipMaterial.findFirst({ where: { id, ...(isSuperAdmin ? {} : { rootMemberId: context!.rootId }) } });
  if (!material) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return new Response(new Uint8Array(material.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="discipulado-${material.month}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
