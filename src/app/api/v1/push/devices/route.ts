import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { readSessionOrBearer } from "@/server/auth-jwt";

export const dynamic = "force-dynamic";

const RegisterBody = z.object({
  expoPushToken: z.string().min(1),
  platform: z.string().nullish(),
  deviceName: z.string().nullish(),
  appVersion: z.string().nullish(),
});

const UnregisterBody = z.object({
  expoPushToken: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await readSessionOrBearer(req);
  if (!session?.uid) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  let json;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const parsed = RegisterBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { expoPushToken, platform, deviceName, appVersion } = parsed.data;
  try {
    const upserted = await prisma.pushDevice.upsert({
      where: { expoPushToken },
      create: {
        userId: session.uid,
        expoPushToken,
        platform: platform ?? null,
        deviceName: deviceName ?? null,
        appVersion: appVersion ?? null,
        active: true,
        lastSeen: new Date(),
      },
      update: {
        userId: session.uid,
        platform: platform ?? undefined,
        deviceName: deviceName ?? undefined,
        appVersion: appVersion ?? undefined,
        active: true,
        lastSeen: new Date(),
      },
    });
    return NextResponse.json({ ok: true, id: upserted.id });
  } catch (err) {
    return NextResponse.json({ error: "DB_ERROR", detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await readSessionOrBearer(req);
  if (!session?.uid) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  let json;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const parsed = UnregisterBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const { expoPushToken } = parsed.data;
  try {
    await prisma.pushDevice.updateMany({
      where: { expoPushToken, userId: session.uid },
      data: { active: false, lastSeen: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}
