"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Megaphone, User } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/app", label: "Início", icon: <Home className="size-5" /> },
  { href: "/app/calendar", label: "Agenda", icon: <Calendar className="size-5" /> },
  { href: "/app/notifications", label: "Avisos", icon: <Megaphone className="size-5" /> },
  { href: "/app/profile", label: "Perfil", icon: <User className="size-5" /> },
];

export function MobileShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full w-full">
      <div className="mx-auto w-full max-w-xl px-4 pb-24 pt-6">
        <div className="mb-5 flex items-center justify-between rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.55)] px-4 py-3 shadow-[0_18px_70px_-60px_rgba(88,167,255,0.7)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Image
              src="https://vgon.com.br/wp-content/uploads/2026/05/653710779_1244850837750825_1067912328932006259_n.png"
              alt="Ministério Viva Church"
              width={34}
              height={34}
              className="rounded-xl"
              style={{ width: "auto", height: "auto" }}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Viva Church Manager</div>
              <div className="truncate text-xs text-muted-foreground">Mobile</div>
            </div>
          </div>
        </div>
        {props.children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-[rgba(11,23,48,0.65)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-2.5">
          {items.map((it) => {
            const active = pathname === it.href || pathname?.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex w-20 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-semibold transition-[background,box-shadow,color]",
                  active
                    ? "bg-[rgba(88,167,255,0.16)] text-foreground shadow-[0_14px_50px_-36px_rgba(88,167,255,0.95)]"
                    : "text-muted-foreground hover:bg-muted/10 hover:text-foreground",
                )}
              >
                {it.icon}
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
