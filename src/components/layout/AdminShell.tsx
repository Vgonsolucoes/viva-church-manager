"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Baby,
  Bell,
  Calendar,
  ClipboardList,
  GraduationCap,
  HandHeart,
  LayoutDashboard,
  Layers,
  Package,
  PiggyBank,
  Receipt,
  Search,
  Waypoints,
  ChartColumn,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  permission: Parameters<typeof hasPermission>[1];
};

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: <LayoutDashboard className="size-4" />,
    permission: "dashboard:view",
  },
  {
    href: "/admin/members",
    label: "Membros",
    icon: <Users className="size-4" />,
    permission: "members:read",
  },
  {
    href: "/admin/acompanhamento",
    label: "Acompanhamento",
    icon: <HandHeart className="size-4" />,
    permission: "followup:read",
  },
  {
    href: "/admin/volunteers",
    label: "Voluntários",
    icon: <UsersRound className="size-4" />,
    permission: "volunteers:read",
  },
  {
    href: "/admin/schedules",
    label: "Escalas",
    icon: <ClipboardList className="size-4" />,
    permission: "schedules:read",
  },
  {
    href: "/admin/ministries",
    label: "Ministérios",
    icon: <Layers className="size-4" />,
    permission: "ministries:read",
  },
  {
    href: "/admin/calendar",
    label: "Agenda",
    icon: <Calendar className="size-4" />,
    permission: "calendar:read",
  },
  {
    href: "/admin/events",
    label: "Eventos",
    icon: <HandHeart className="size-4" />,
    permission: "events:read",
  },
  {
    href: "/admin/courses",
    label: "Cursos",
    icon: <GraduationCap className="size-4" />,
    permission: "courses:read",
  },
  {
    href: "/admin/cells",
    label: "Células / Reuniões",
    icon: <Waypoints className="size-4" />,
    permission: "cells:read",
  },
  {
    href: "/admin/kids",
    label: "Ministério Infantil",
    icon: <Baby className="size-4" />,
    permission: "kids:read",
  },
  {
    href: "/admin/finance",
    label: "Financeiro",
    icon: <PiggyBank className="size-4" />,
    permission: "finance:read",
  },
  {
    href: "/admin/assets",
    label: "Patrimônio",
    icon: <Package className="size-4" />,
    permission: "assets:read",
  },
  {
    href: "/admin/lost-found",
    label: "Achados e Perdidos",
    icon: <Package className="size-4" />,
    permission: "lostfound:read",
  },
  {
    href: "/admin/reports",
    label: "Relatórios",
    icon: <Receipt className="size-4" />,
    permission: "reports:view",
  },
  {
    href: "/admin/settings",
    label: "Configurações",
    icon: <Settings className="size-4" />,
    permission: "settings:manage",
  },
];

const extraItems: NavItem[] = [
  {
    href: "/admin/discipleships",
    label: "Discipulados",
    icon: <Waypoints className="size-4" />,
    permission: "discipleships:read",
  },
  {
    href: "/admin/budget",
    label: "Orçamento",
    icon: <ChartColumn className="size-4" />,
    permission: "budget:read",
  },
  {
    href: "/admin/notifications",
    label: "Notificações",
    icon: <Bell className="size-4" />,
    permission: "notifications:read",
  },
];

export function AdminShell(props: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    roles: RoleKey[];
    unreadNotifications: number;
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<"today" | "week" | "month">("today");

  const allowed = navItems.filter((i) => hasPermission(props.user.roles, i.permission));
  const allowedExtra = extraItems.filter((i) => hasPermission(props.user.roles, i.permission));

  const initials = useMemo(() => {
    const name = props.user.name?.trim() || props.user.email?.trim() || "U";
    const parts = name.split(/\s+/g).filter(Boolean);
    const first = parts[0]?.[0] ?? "U";
    const second = parts.length > 1 ? parts[1]?.[0] : (parts[0]?.[1] ?? "");
    return (first + (second ?? "")).toUpperCase();
  }, [props.user.email, props.user.name]);

  const roleLabel = useMemo(() => {
    const roles = props.user.roles;
    if (roles.includes("SUPER_ADMIN")) return "Super Admin";
    if (roles.includes("PASTOR_PRESIDENTE")) return "Pastor Presidente";
    if (roles.includes("PASTOR")) return "Pastor";
    if (roles.includes("FINANCE")) return "Financeiro";
    if (roles.includes("SECRETARY")) return "Secretaria";
    if (roles.includes("MINISTRY_LEADER")) return "Líder de Ministério";
    if (roles.includes("CELL_LEADER")) return "Líder de Célula";
    return "Administrador";
  }, [props.user.roles]);

  const rangeLabel = useMemo(() => {
    const now = new Date();
    const label = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(now);
    if (range === "today") return label;
    if (range === "week") return `Semana • ${label}`;
    return `Mês • ${label}`;
  }, [range]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/admin/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-full w-full">
      <div className="mx-auto flex w-full max-w-[1480px] gap-6 px-4 py-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.60)] p-4 shadow-[0_18px_70px_-48px_rgba(88,167,255,0.7)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Image
                  src="https://vgon.com.br/wp-content/uploads/2026/05/653710779_1244850837750825_1067912328932006259_n.png"
                  alt="Ministério Viva Church"
                  width={36}
                  height={36}
                  className="rounded-xl"
                  style={{ width: "auto", height: "auto" }}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-wide text-foreground">
                    Viva Church Manager
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Ministério Viva Church
                  </div>
                </div>
              </div>
            </div>
            <nav className="rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.55)] p-2 backdrop-blur-xl">
              {allowed.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium tracking-tight transition-[background,box-shadow,transform,color]",
                      active
                        ? "bg-[rgba(88,167,255,0.16)] text-foreground shadow-[0_14px_50px_-36px_rgba(88,167,255,0.95)]"
                        : "text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                    )}
                  >
                    <span className={cn("text-muted-foreground group-hover:text-foreground", active ? "text-foreground" : "")}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            {allowedExtra.length ? (
              <div className="rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.45)] p-2 backdrop-blur-xl">
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Extras
                </div>
                {allowedExtra.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname?.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium tracking-tight transition-[background,box-shadow,transform,color]",
                        active
                          ? "bg-[rgba(88,167,255,0.16)] text-foreground shadow-[0_14px_50px_-36px_rgba(88,167,255,0.95)]"
                          : "text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "text-muted-foreground group-hover:text-foreground",
                          active ? "text-foreground" : "",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
            <div className="rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.55)] p-4 backdrop-blur-xl">
              <div className="text-xs font-semibold text-muted-foreground">Viva Church • Ministério</div>
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/80 bg-muted/10 px-3 py-2">
                <div className="text-xs font-semibold text-muted-foreground">Ver site</div>
                <a
                  href="https://vgon.com.br"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-foreground hover:text-primary"
                >
                  Abrir
                </a>
              </div>
              <div className="mt-2 flex items-center gap-3">
                {typeof props.user.image === "string" && props.user.image.length > 0 ? (
                  <Image
                    src={props.user.image}
                    alt={props.user.name ?? "Usuário"}
                    width={36}
                    height={36}
                    className="size-9 rounded-2xl object-cover"
                    unoptimized
                    loader={({ src }) => src}
                  />
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-2xl bg-muted/30 text-xs font-semibold text-foreground">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{props.user.name ?? "Usuário"}</div>
                  <div className="truncate text-xs text-muted-foreground">{roleLabel}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <ThemeToggle />
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="hidden items-center justify-between gap-4 rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.55)] px-4 py-3 shadow-[0_18px_70px_-60px_rgba(88,167,255,0.7)] backdrop-blur-xl lg:flex">
            <div className="min-w-0 flex-1">
              <form onSubmit={onSearchSubmit} className="relative max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar (membros, eventos, patrimônio...)"
                  className="h-11 pl-10"
                />
              </form>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/notifications"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/80 bg-muted/10 text-foreground hover:bg-muted/20"
                aria-label="Notificações"
              >
                <Bell className="size-4" />
                {props.user.unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {props.user.unreadNotifications > 99
                      ? "99+"
                      : props.user.unreadNotifications}
                  </span>
                ) : null}
              </Link>
              <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-muted/10 px-3 py-2">
                <div className="text-xs font-semibold text-muted-foreground">Período</div>
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value as "today" | "week" | "month")}
                  className="h-7 rounded-xl border border-border/80 bg-muted/10 px-2 text-xs text-foreground"
                >
                  <option value="today">Hoje</option>
                  <option value="week">Semana</option>
                  <option value="month">Mês</option>
                </select>
              </div>
              <div className="hidden rounded-2xl border border-border/80 bg-muted/10 px-3 py-2 text-xs text-muted-foreground xl:block">
                {rangeLabel}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 px-2 py-1.5">
                {typeof props.user.image === "string" && props.user.image.length > 0 ? (
                  <Image
                    src={props.user.image}
                    alt={props.user.name ?? "Usuário"}
                    width={28}
                    height={28}
                    className="size-7 rounded-full object-cover"
                    unoptimized
                    loader={({ src }) => src}
                  />
                ) : (
                  <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                    {initials}
                  </div>
                )}
                <div className="hidden md:block">
                  <div className="max-w-[220px] truncate text-xs font-semibold">
                    {props.user.name ?? "Usuário"}
                  </div>
                  <div className="max-w-[220px] truncate text-[11px] text-muted-foreground">
                    {roleLabel}
                  </div>
                </div>
              </div>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sair
              </Button>
            </div>
          </div>

          <header className="flex items-center justify-between rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.55)] px-4 py-3 shadow-[0_18px_70px_-60px_rgba(88,167,255,0.7)] backdrop-blur-xl lg:hidden">
            <div className="min-w-0 flex items-center gap-3">
              <Image
                src="https://vgon.com.br/wp-content/uploads/2026/05/653710779_1244850837750825_1067912328932006259_n.png"
                alt="Ministério Viva Church"
                width={32}
                height={32}
                className="rounded-xl"
                style={{ width: "auto", height: "auto" }}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Viva Church Manager</div>
                <div className="truncate text-xs text-muted-foreground">
                  {props.user.name ?? props.user.email ?? ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/notifications"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-transparent text-foreground hover:bg-muted/60"
                aria-label="Notificações"
              >
                <Bell className="size-4" />
                {props.user.unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {props.user.unreadNotifications > 99
                      ? "99+"
                      : props.user.unreadNotifications}
                  </span>
                ) : null}
              </Link>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sair
              </Button>
            </div>
          </header>

          <main className="min-w-0 flex-1">{props.children}</main>
        </div>
      </div>
    </div>
  );
}
