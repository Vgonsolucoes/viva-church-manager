import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { readSessionOrBearer } from "@/server/auth-jwt";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await readSessionOrBearer(req);
  if (!session?.uid) return NextResponse.json({ ok: false }, { status: 401 });

  const deliveries = await prisma.notificationDelivery.findMany({
    where: { userId: session.uid },
    orderBy: { deliveredAt: "desc" },
    take: 50,
    include: { notification: true },
  });

  return NextResponse.json({
    ok: true,
    deliveries: deliveries.map((d: any) => ({
      id: d.id,
      deliveredAt: d.deliveredAt,
      readAt: d.readAt,
      notification: {
        id: d.notification.id,
        title: d.notification.title,
        body: d.notification.body,
        createdAt: d.notification.createdAt,
      },
    })),
  });
}

const readSchema = z.object({ deliveryId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await readSessionOrBearer(req);
  if (!session?.uid) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = readSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await prisma.notificationDelivery.updateMany({
    where: { id: parsed.data.deliveryId, userId: session.uid },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

