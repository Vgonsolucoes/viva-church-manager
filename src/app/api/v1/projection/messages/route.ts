import { NextResponse } from "next/server";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";
import { prisma } from "@/server/db";
import { listPendingProjectionMessages } from "@/server/kids-projection";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const kids = hasPermission(logged.ctx.roles, "kids:projection:view");
  const parking = hasPermission(logged.ctx.roles, "parking:projection:view");
  if (!kids && !parking) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  const [kidsMessages, parkingMessages] = await Promise.all([
    kids ? listPendingProjectionMessages(50) : [],
    parking ? prisma.parkingProjectionMessage.findMany({ where: { status: "PENDING" }, orderBy: { sentAt: "asc" }, take: 50 }) : [],
  ]);
  const messages = [
    ...kidsMessages.map(m => ({ id: m.id, channel: "KIDS", childName: m.child.fullName, message: m.message, sentAt: m.sentAt.toISOString() })),
    ...parkingMessages.map(m => ({ id: m.id, channel: "PARKING", childName: m.plate, message: [m.vehicle, m.color, m.message, `Local: ${m.location}`].filter(Boolean).join(" · "), sentAt: m.sentAt.toISOString() })),
  ].sort((a, b) => a.sentAt.localeCompare(b.sentAt)).slice(0, 50);
  return NextResponse.json({ messages });
}
