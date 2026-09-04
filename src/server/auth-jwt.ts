import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, base64url, type JWTPayload } from "jose";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import type { RoleKey } from "@/server/rbac";

export type VerifiedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  roles: RoleKey[];
};

type AppJwtClaims = JWTPayload & {
  uid: string;
  sub: string;
  email: string;
  roles: RoleKey[];
  name?: string;
  picture?: string | null;
};

export type AppJwtSession = {
  uid: string;
  email: string;
  roles: RoleKey[];
  name?: string;
  picture?: string | null;
};

export function requireNextAuthSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error("[auth-jwt] NEXTAUTH_SECRET não configurada.");
  }
  try {
    return base64url.decode(raw);
  } catch {
    return new TextEncoder().encode(raw);
  }
}

function getJwtTtlDays(): number {
  const parsed = Number(process.env.APP_JWT_EXPIRES_IN_DAYS ?? 30);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return parsed;
}

export async function verifyUserCredentials(
  email: string,
  password: string,
): Promise<VerifiedUser | null> {
  const normalizedEmail = email?.toLowerCase().trim();
  if (!normalizedEmail || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      roles: true,
      member: { select: { photoUrl: true } },
    },
  });
  if (!user || !user.passwordHash) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const resolvedImage = user.imageUrl ?? user.member?.photoUrl ?? null;

  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    image: resolvedImage,
    roles: user.roles.map((r) => r.role) as RoleKey[],
  };
}

export async function signAppJwt(user: VerifiedUser): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const secret = requireNextAuthSecret();
  const ttlDays = getJwtTtlDays();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const expSec = Math.floor(expiresAt.getTime() / 1000);

  const jwt = await new SignJWT({
    uid: user.id,
    sub: user.id,
    email: user.email,
    roles: user.roles,
    name: user.name,
    picture: user.image ?? null,
  } satisfies AppJwtClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(expSec)
    .sign(secret);

  return { accessToken: jwt, expiresAt };
}

export async function verifyAppJwt(token: string): Promise<AppJwtSession | null> {
  const secret = requireNextAuthSecret();
  try {
    const { payload } = await jwtVerify<AppJwtClaims>(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.uid || !payload.email) return null;
    return {
      uid: payload.uid,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? (payload.roles as RoleKey[]) : [],
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1] ?? null;
  }
  return null;
}

export async function readSessionOrBearer(
  req: Request,
): Promise<AppJwtSession | null> {
  const bearer = extractBearerToken(req as NextRequest);
  if (bearer) {
    const verified = await verifyAppJwt(bearer);
    if (verified) return verified;
  }

  try {
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    if (!nextAuthSecret) return null;
    const token = await getToken({
      req: req as unknown as Parameters<typeof getToken>[0]["req"],
      secret: nextAuthSecret,
      raw: false,
    });
    if (!token || !token.uid) return null;
    return {
      uid: String(token.uid),
      email: String(token.email ?? ""),
      roles: (token.roles as RoleKey[]) ?? [],
      name: String(token.name ?? ""),
      picture: token.picture ?? null,
    };
  } catch {
    return null;
  }
}
