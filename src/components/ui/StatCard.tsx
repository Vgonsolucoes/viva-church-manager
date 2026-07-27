import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Tone = "blue" | "purple" | "emerald" | "orange" | "red";

const toneStyles: Record<Tone, { iconBg: string; glow: string }> = {
  blue: {
    iconBg: "bg-[rgba(88,167,255,0.18)] text-[rgba(88,167,255,1)]",
    glow: "shadow-[0_18px_70px_-38px_rgba(88,167,255,0.85)]",
  },
  purple: {
    iconBg: "bg-[rgba(162,105,255,0.18)] text-[rgba(162,105,255,1)]",
    glow: "shadow-[0_18px_70px_-38px_rgba(162,105,255,0.85)]",
  },
  emerald: {
    iconBg: "bg-[rgba(34,197,94,0.16)] text-[rgba(34,197,94,1)]",
    glow: "shadow-[0_18px_70px_-38px_rgba(34,197,94,0.8)]",
  },
  orange: {
    iconBg: "bg-[rgba(249,115,22,0.16)] text-[rgba(249,115,22,1)]",
    glow: "shadow-[0_18px_70px_-38px_rgba(249,115,22,0.75)]",
  },
  red: {
    iconBg: "bg-[rgba(244,63,94,0.16)] text-[rgba(244,63,94,1)]",
    glow: "shadow-[0_18px_70px_-38px_rgba(244,63,94,0.75)]",
  },
};

export function StatCard(props: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  trend?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tone = props.tone ?? "blue";
  const t = toneStyles[tone];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-[transform,box-shadow] hover:-translate-y-0.5",
        t.glow,
        props.className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        {props.icon ? (
          <div className={cn("flex size-10 items-center justify-center rounded-2xl", t.iconBg)}>
            <div className="text-current">{props.icon}</div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight text-foreground">{props.value}</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          {props.subtitle ? (
            <div className="text-sm text-muted-foreground">{props.subtitle}</div>
          ) : (
            <div />
          )}
          {props.trend ? (
            <div className="text-xs font-semibold text-muted-foreground">{props.trend}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
