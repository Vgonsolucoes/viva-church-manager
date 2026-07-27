import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  ministry: z.string().optional(),
  availability: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const ministry =
    parsed.data.ministry && parsed.data.ministry.trim().length
      ? await prisma.ministry.upsert({
          where: { name: parsed.data.ministry.trim() },
          update: {},
          create: { name: parsed.data.ministry.trim() },
        })
      : null;

  const member = await prisma.member.create({
    data: {
      fullName: parsed.data.fullName.trim(),
      email: parsed.data.email ? parsed.data.email.toLowerCase().trim() : null,
      phone: parsed.data.phone ? parsed.data.phone.trim() : null,
      type: "VOLUNTEER",
      types: ["VOLUNTEER"],
      ministryId: ministry?.id ?? null,
      memberMinistries: ministry?.id
        ? { createMany: { data: [{ ministryId: ministry.id }] } }
        : undefined,
    },
  });

  const volunteer = await prisma.volunteerProfile.create({
    data: {
      memberId: member.id,
      ministryId: ministry?.id ?? null,
      availability: parsed.data.availability ? parsed.data.availability.trim() : null,
      skills: [],
    },
  });

  await logAudit({
    action: "CREATE_PUBLIC",
    entityType: "VolunteerProfile",
    entityId: volunteer.id,
    after: {
      id: volunteer.id,
      memberId: volunteer.memberId,
      ministryId: volunteer.ministryId,
    },
  });

  return NextResponse.json({ ok: true, id: volunteer.id });
}
