import { NextResponse } from "next/server";
import { z } from "zod";
import {
  signAppJwt,
  verifyUserCredentials,
} from "@/server/auth-jwt";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z
    .string()
    .min(1, "E-mail obrigatório")
    .email("Informe um e-mail válido")
    .max(255)
    .trim(),
  password: z
    .string()
    .min(1, "Senha obrigatória")
    .max(255),
});

const RateWindowMs = 60_000;
const RateLimitPerIp = 5;
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function getIp(req: Request): string {
  const headersList = req.headers as unknown as {
    get(name: "x-forwarded-for" | "x-real-ip"): string | null;
  };
  void headersList;
  const forw = (req.headers as Headers).get("x-forwarded-for");
  if (forw) return forw.split(",")[0]!.trim();
  const real = (req.headers as Headers).get("x-real-ip");
  if (real) return real;
  return "__unknown__";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || current.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + RateWindowMs });
    return true;
  }
  if (current.count >= RateLimitPerIp) return false;
  current.count += 1;
  return true;
}

export async function POST(req: Request) {
  const ip = getIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const user = await verifyUserCredentials(email.toLowerCase(), password);
  if (!user) {
    return NextResponse.json(
      { error: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  const { accessToken, expiresAt } = await signAppJwt(user);

  return NextResponse.json({
    accessToken,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      roles: user.roles,
    },
  });
}
