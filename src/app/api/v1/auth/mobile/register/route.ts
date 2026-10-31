import { NextResponse } from "next/server";
import { registerVisitor } from "@/server/visitor-registration";

export const dynamic = "force-dynamic";
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW = 15 * 60_000;

export async function POST(req: Request) {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const bucket = buckets.get(ip) ?? { count: 0, resetAt: now + WINDOW };
  if (bucket.count >= 5 || (!buckets.has(ip) && buckets.size >= 10_000)) return NextResponse.json({ error: "TOO_MANY_REQUESTS", message: "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))) } });
  bucket.count++;
  buckets.set(ip, bucket);
  if (Number(req.headers.get("content-length") ?? 0) > 8192) return NextResponse.json({ error: "INVALID_BODY", message: "Cadastro inválido." }, { status: 413 });
  const text = await req.text();
  if (text.length > 8192) return NextResponse.json({ error: "INVALID_BODY", message: "Cadastro inválido." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "INVALID_BODY", message: "Confira os dados informados." }, { status: 400 }); }
  try {
    const { status, ...result } = await registerVisitor(body);
    return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Do not log the public request, CPF, password or database exception payload.
    console.error("[mobile-register] Não foi possível concluir o cadastro.");
    return NextResponse.json({ error: "REGISTRATION_FAILED", message: "Não foi possível cadastrar agora. Tente novamente em instantes." }, { status: 500 });
  }
}
