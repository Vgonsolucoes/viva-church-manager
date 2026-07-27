"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, ClipboardList, HeartHandshake, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/cn";

type ServiceItem = {
  id: string;
  title: string;
  subtitle: string;
  day: string;
  month: string;
};

type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  day: string;
  month: string;
};

type CellsStats = {
  total: number;
  active: number;
  newCells: number;
  forming: number;
};

type FinancePoint = {
  label: string;
  inCents: number;
  outCents: number;
  balanceCents: number;
};

type FundraisingItem = {
  id: string;
  name: string;
  raisedCents: number;
  goalCents: number | null;
  pct: number;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tooltipStyle() {
  return {
    background: "rgba(7, 17, 31, 0.92)",
    border: "1px solid rgba(234, 241, 255, 0.10)",
    borderRadius: 18,
    color: "rgba(234, 241, 255, 0.95)",
    boxShadow: "0 18px 70px -48px rgba(88,167,255,0.9)",
  } as const;
}

function sectionVariants() {
  return {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  };
}

export function DashboardClient(props: {
  greetingName: string;
  metrics: {
    members: number;
    newMembers: number;
    volunteers: number;
    schedulesPending: number;
  };
  services: ServiceItem[];
  events: EventItem[];
  cells: CellsStats;
  finance: {
    inCents: number;
    outCents: number;
    balanceCents: number;
    series: FinancePoint[];
  };
  fundraising?: FundraisingItem[];
  bottom: {
    assetsCount: number;
    kidsActive: number;
    lostFoundPending: number;
    alertsCount: number;
  };
}) {
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setChartsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const donutData = [
    { name: "Em andamento", value: props.cells.active, color: "rgba(88,167,255,1)" },
    { name: "Novas", value: props.cells.newCells, color: "rgba(162,105,255,1)" },
    { name: "Em formação", value: props.cells.forming, color: "rgba(34,197,94,1)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <motion.div variants={sectionVariants()} initial="hidden" animate="show">
        <div className="text-2xl font-semibold tracking-tight text-foreground">
          Olá, {props.greetingName}{" "}
          <span className="ml-1 inline-block select-none">👋</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Bem-vindo ao painel de gestão da sua igreja.
        </div>
      </motion.div>

      <motion.div
        variants={sectionVariants()}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          title="Membros"
          value={props.metrics.members.toLocaleString("pt-BR")}
          subtitle="Total cadastrado"
          trend={
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="size-3" /> {props.metrics.newMembers} este mês
            </span>
          }
          icon={<Users className="size-4" />}
          tone="blue"
        />
        <StatCard
          title="Novos Membros"
          value={props.metrics.newMembers.toLocaleString("pt-BR")}
          subtitle="Últimos 30 dias"
          trend={
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="size-3" /> Em integração
            </span>
          }
          icon={<UserPlus className="size-4" />}
          tone="purple"
        />
        <StatCard
          title="Voluntários Ativos"
          value={props.metrics.volunteers.toLocaleString("pt-BR")}
          subtitle="Equipe ativa"
          trend={
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="size-3" /> Em escalas
            </span>
          }
          icon={<HeartHandshake className="size-4" />}
          tone="emerald"
        />
        <StatCard
          title="Escalas Pendentes"
          value={props.metrics.schedulesPending.toLocaleString("pt-BR")}
          subtitle="Confirmações"
          trend={<span>Próximos cultos</span>}
          icon={<ClipboardList className="size-4" />}
          tone="orange"
        />
      </motion.div>

      <motion.div
        variants={sectionVariants()}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 xl:grid-cols-12"
      >
        <Card className="min-w-0 xl:col-span-4">
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="text-sm font-semibold">Próximos Cultos</div>
            <Link
              href="/admin/schedules"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Ver todos
            </Link>
          </div>
          <div className="px-6 pb-6 pt-4 space-y-2">
            {props.services.length ? (
              props.services.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center justify-between rounded-2xl border border-border/80 bg-muted/10 px-4 py-3 transition-[background,box-shadow] hover:bg-muted/20 hover:shadow-[0_18px_60px_-46px_rgba(88,167,255,0.7)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{s.title}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{s.subtitle}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-foreground">{s.day}</div>
                      <div className="text-[11px] text-muted-foreground">{s.month}</div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum culto cadastrado.</div>
            )}
          </div>
        </Card>

        <Card className="min-w-0 xl:col-span-4">
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="text-sm font-semibold">Próximos Eventos</div>
            <Link
              href="/admin/events"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Ver todos
            </Link>
          </div>
          <div className="px-6 pb-6 pt-4 space-y-2">
            {props.events.length ? (
              props.events.map((e) => (
                <div
                  key={e.id}
                  className="group flex items-center justify-between rounded-2xl border border-border/80 bg-muted/10 px-4 py-3 transition-[background,box-shadow] hover:bg-muted/20 hover:shadow-[0_18px_60px_-46px_rgba(162,105,255,0.7)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{e.title}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{e.subtitle}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-foreground">{e.day}</div>
                      <div className="text-[11px] text-muted-foreground">{e.month}</div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum evento cadastrado.</div>
            )}
          </div>
        </Card>

        <Card className="min-w-0 xl:col-span-4">
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="text-sm font-semibold">Células Ativas</div>
            <Link
              href="/admin/cells"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Ver todos
            </Link>
          </div>
          <div className="px-6 pb-6 pt-4 grid grid-cols-2 gap-4">
            <div className="relative h-44">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={74}
                      stroke="rgba(234,241,255,0.06)"
                      strokeWidth={2}
                      paddingAngle={2}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle()} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full" />
              )}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-semibold">{props.cells.total}</div>
                <div className="text-xs text-muted-foreground">Células</div>
              </div>
            </div>

            <div className="space-y-2">
              <LegendRow color="rgba(88,167,255,1)" label="Em andamento" value={props.cells.active} />
              <LegendRow color="rgba(162,105,255,1)" label="Novas" value={props.cells.newCells} />
              <LegendRow color="rgba(34,197,94,1)" label="Em formação" value={props.cells.forming} />
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={sectionVariants()} initial="hidden" animate="show">
        <Card className="min-w-0">
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="text-sm font-semibold">Resumo Financeiro</div>
            <Link
              href="/admin/finance"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Ver relatório
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-4 xl:grid-cols-12">
            <div className="xl:col-span-5 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-1">
              <FinancePill title="Entradas (mês)" value={brl(props.finance.inCents)} tone="emerald" />
              <FinancePill title="Saídas (mês)" value={brl(props.finance.outCents)} tone="red" />
              <FinancePill title="Saldo Atual" value={brl(props.finance.balanceCents)} tone="purple" />
            </div>
            <div className="min-w-0 xl:col-span-7 h-56">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={props.finance.series} margin={{ left: 8, right: 12, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="finFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="rgba(162,105,255,1)" stopOpacity={0.30} />
                        <stop offset="95%" stopColor="rgba(162,105,255,1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(234,241,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(234,241,255,0.55)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(234,241,255,0.55)" }} width={34} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Area type="monotone" dataKey="balanceCents" stroke="rgba(162,105,255,1)" fill="url(#finFill)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="inCents" stroke="rgba(34,197,94,1)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="outCents" stroke="rgba(244,63,94,1)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {props.fundraising?.length ? (
        <motion.div variants={sectionVariants()} initial="hidden" animate="show">
          <Card>
            <div className="flex items-center justify-between px-6 pt-6">
              <div className="text-sm font-semibold">Projetos em captação</div>
              <Link
                href="/admin/reports"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Ver todos
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 px-6 pb-6 pt-4 md:grid-cols-2 xl:grid-cols-4">
              {props.fundraising.map((p) => (
                <div
                  key={p.id}
                  className="rounded-3xl border border-border/80 bg-muted/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{brl(p.raisedCents)}</span>
                    <span className="font-semibold text-foreground">{p.pct}%</span>
                  </div>
                  <div className="mt-3 h-2.5 w-full rounded-full bg-muted/30">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-[#2b8cff] via-[#58a7ff] to-[#a269ff]"
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {p.goalCents ? `Meta: ${brl(p.goalCents)}` : "Meta não definida"}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div
        variants={sectionVariants()}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <BottomCard
          title="Patrimônio"
          value={props.bottom.assetsCount}
          subtitle="Itens cadastrados"
          tone="blue"
          href="/admin/assets"
        />
        <BottomCard
          title="Ministério Infantil"
          value={props.bottom.kidsActive}
          subtitle="Check-ins ativos"
          tone="purple"
          href="/admin/kids"
        />
        <BottomCard
          title="Achados e Perdidos"
          value={props.bottom.lostFoundPending}
          subtitle="Pendências"
          tone="orange"
          href="/admin/lost-found"
        />
        <BottomCard
          title="Alertas Importantes"
          value={props.bottom.alertsCount}
          subtitle="Ações sugeridas"
          tone="red"
          href="/admin/notifications"
        />
      </motion.div>
    </div>
  );
}

function LegendRow(props: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: props.color }} />
        <span className="text-xs font-semibold text-muted-foreground">{props.label}</span>
      </div>
      <span className="text-xs font-semibold text-foreground">{props.value}</span>
    </div>
  );
}

function FinancePill(props: { title: string; value: string; tone: "emerald" | "red" | "purple" }) {
  const tone = props.tone;
  const toneClass =
    tone === "emerald"
      ? "border-[rgba(34,197,94,0.20)] bg-[rgba(34,197,94,0.08)]"
      : tone === "red"
        ? "border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.08)]"
        : "border-[rgba(162,105,255,0.22)] bg-[rgba(162,105,255,0.08)]";

  return (
    <div className={cn("rounded-3xl border px-4 py-3", toneClass)}>
      <div className="text-xs font-semibold text-muted-foreground">{props.title}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-foreground">{props.value}</div>
    </div>
  );
}

function BottomCard(props: {
  title: string;
  value: number;
  subtitle: string;
  tone: "blue" | "purple" | "emerald" | "orange" | "red";
  href: string;
}) {
  const tone =
    props.tone === "blue"
      ? "bg-[rgba(88,167,255,0.08)] border-[rgba(88,167,255,0.18)]"
      : props.tone === "purple"
        ? "bg-[rgba(162,105,255,0.08)] border-[rgba(162,105,255,0.18)]"
        : props.tone === "emerald"
          ? "bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.18)]"
          : props.tone === "orange"
            ? "bg-[rgba(249,115,22,0.08)] border-[rgba(249,115,22,0.18)]"
            : "bg-[rgba(244,63,94,0.08)] border-[rgba(244,63,94,0.18)]";

  return (
    <Link href={props.href} className="block">
      <div className={cn("group rounded-3xl border p-5 transition-[transform,box-shadow] hover:-translate-y-0.5", tone)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold">{props.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{props.subtitle}</div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-tight">{props.value}</div>
      </div>
    </Link>
  );
}
