import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { requireLoggedIn } from "@/server/session-helpers";
import { requireNextAuthSecret } from "@/server/auth-jwt";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const secret = requireNextAuthSecret();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 900;
  const expiresAt = new Date(exp * 1000);

  const token = await new SignJWT({
    sub: ctx.member?.id ?? ctx.user.id,
    type: "member-card",
    name: ctx.user.name ?? ctx.member?.fullName ?? "",
    email: ctx.user.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secret);

  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
    type: "member-card",
  });
}
