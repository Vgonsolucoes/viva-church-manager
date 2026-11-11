import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { getUserAccess } from "@/server/access-control";
import { webModuleForPath, WEB_MODULES } from "@/lib/access-control";
import { hasPermission } from "@/server/rbac";

export default async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/public/") || pathname.startsWith("/api/v1/") || pathname.startsWith("/api/uploads/") || pathname === "/api/notifications" || pathname === "/login" || pathname === "/") return NextResponse.next();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.uid) return pathname.startsWith("/api/") ? NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) : NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
  const access = await getUserAccess(String(token.uid));
  if (!access) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  // Self-service uploads also accept a mobile bearer token and authorize in their handler.
  if (pathname.startsWith("/api/uploads/")) return NextResponse.next();
  if (pathname === "/projecao" || pathname.startsWith("/kids/projecao")) {
    return hasPermission(access.webPermissions, "kids:projection:view") || hasPermission(access.webPermissions, "parking:projection:view") ? NextResponse.next() : NextResponse.redirect(new URL("/login?error=WebAccessDenied", req.url));
  }
  if (!access.webEnabled) return pathname.startsWith("/api/") ? NextResponse.json({ error: "WEB_ACCESS_DENIED" }, { status: 403 }) : NextResponse.redirect(new URL("/login?error=WebAccessDenied", req.url));
  if (pathname.startsWith("/app")) return NextResponse.redirect(new URL(WEB_MODULES.find(m => access.webModules.includes(m.key))?.path ?? "/login", req.url));
  if (access.roles.includes("SUPER_ADMIN")) return NextResponse.next();
  if (pathname.startsWith("/admin")) {
    const entry = webModuleForPath(pathname);
    const fallback = WEB_MODULES.find(m => access.webModules.includes(m.key))?.path;
    if (!entry || !access.webModules.includes(entry.key)) {
      if (req.method !== "GET" && req.method !== "HEAD") return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
      if (fallback && fallback !== pathname) return NextResponse.redirect(new URL(fallback, req.url));
      return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    }
    // The cell detail actions check leadership for that cell. Deletion still requires cells:write.
    const cellDetail = entry.key === "cells" && /^\/admin\/cells\/[^/]+$/.test(pathname);
    if (req.method === "POST" && !cellDetail && entry.write.length && !entry.write.some(p => hasPermission(access.webPermissions, p))) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  // Legacy report/export routes must not bypass the entry grants.
  if (pathname.startsWith("/api/reports/") && !access.webModules.includes("reports")) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  if (pathname.startsWith("/api/assets/") && !access.webModules.includes("assets")) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  if (pathname.startsWith("/api/admin/") && !access.webModules.includes("youtube")) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/app/:path*", "/kids/:path*", "/projecao", "/api/:path*"] };
