import { withAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { hasPermission, type RoleKey } from "@/server/rbac";

const adminRoutePermissions: Array<{ prefix: string; permission: Parameters<typeof hasPermission>[1] }> =
  [
    { prefix: "/admin/members", permission: "members:read" },
    { prefix: "/admin/volunteers", permission: "volunteers:read" },
    { prefix: "/admin/schedules", permission: "schedules:read" },
    { prefix: "/admin/calendar", permission: "calendar:read" },
    { prefix: "/admin/events", permission: "events:read" },
    { prefix: "/admin/courses", permission: "courses:read" },
    { prefix: "/admin/cells", permission: "cells:read" },
    { prefix: "/admin/discipleships", permission: "discipleships:read" },
    { prefix: "/admin/kids", permission: "kids:read" },
    { prefix: "/admin/assets", permission: "assets:read" },
    { prefix: "/admin/lost-found", permission: "lostfound:read" },
    { prefix: "/admin/finance", permission: "finance:read" },
    { prefix: "/admin/budget", permission: "budget:read" },
    { prefix: "/admin/notifications", permission: "notifications:read" },
    { prefix: "/admin/reports", permission: "reports:view" },
    { prefix: "/admin/settings", permission: "settings:manage" },
  ];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token as JWT | null;
    const roles = (token?.roles ?? []) as RoleKey[];

    if (pathname.startsWith("/admin")) {
      if (!hasPermission(roles, "admin:access")) {
        const url = req.nextUrl.clone();
        url.pathname = "/app";
        return NextResponse.redirect(url);
      }

      const rule = adminRoutePermissions.find((r) => pathname.startsWith(r.prefix));
      if (rule && !hasPermission(roles, rule.permission)) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        if (
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/public") ||
          pathname.startsWith("/login") ||
          pathname === "/"
        ) {
          return true;
        }

        if (pathname.startsWith("/api/")) {
          return !!token;
        }

        if (pathname.startsWith("/admin") || pathname.startsWith("/app")) {
          return !!token;
        }

        return true;
      },
    },
  },
);

export const config = {
  matcher: ["/admin/:path*", "/app/:path*", "/login", "/", "/api/:path*"],
};
