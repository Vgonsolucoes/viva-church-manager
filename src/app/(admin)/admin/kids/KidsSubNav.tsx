"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  { href: "/admin/kids", label: "Painel", exact: true },
  { href: "/admin/kids/horarios", label: "Horários dos Cultos", exact: false },
  { href: "/admin/kids/qrcode", label: "QR de Check-in", exact: false },
];

export function KidsSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              active
                ? "border-[#58a7ff]/50 bg-[#58a7ff]/15 text-foreground"
                : "border-border/70 bg-muted/10 text-muted-foreground hover:bg-muted/25 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
