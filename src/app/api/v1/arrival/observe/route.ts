import { NextResponse } from "next/server";
import { requireLoggedIn } from "@/server/session-helpers";
import { arrivalObservationSchema } from "@/lib/service-arrival";
import { recordGeoArrival } from "@/server/service-arrival";

export async function POST(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  if (!auth.ctx.member)
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  const input = arrivalObservationSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!input.success)
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_LOCATION",
        message: "Aguarde uma localização com precisão de até 100 metros.",
      },
      { status: 400 },
    );
  const result = await recordGeoArrival(auth.ctx.member.id, input.data);
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.code === "CONSENT_REQUIRED" ? 403 : 422,
  });
}
