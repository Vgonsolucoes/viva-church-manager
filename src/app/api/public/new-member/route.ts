import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const member = await prisma.member.create({
    data: {
      fullName: parsed.data.fullName.trim(),
      email: parsed.data.email ? parsed.data.email.toLowerCase().trim() : null,
      phone: parsed.data.phone ? parsed.data.phone.trim() : null,
      type: "NEW_MEMBER",
      types: ["NEW_MEMBER"],
    },
  });

  await logAudit({
    action: "CREATE_PUBLIC",
    entityType: "Member",
    entityId: member.id,
    after: { id: member.id, fullName: member.fullName, email: member.email, phone: member.phone },
  });

  return NextResponse.json({ ok: true, id: member.id });
}
