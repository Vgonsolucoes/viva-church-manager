import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { getProjectionAccess } from "@/server/projection-access";
import { hasPermission } from "@/server/rbac";
import { prisma } from "@/server/db";
import { ParkingNoticeForm } from "./ParkingNoticeForm";
import { AutoRefresh } from "../kids/checkins/AutoRefresh";

export const dynamic = "force-dynamic";
export default async function ParkingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.uid) redirect("/login");
  const access = await getProjectionAccess(session.uid);
  if (!access.PARKING && !hasPermission(session.roles ?? [], "parking:read")) redirect("/admin");
  const history = await prisma.parkingProjectionMessage.findMany({ orderBy: { sentAt: "desc" }, take: 50, include: { sentBy: { select: { name: true } } } });
  return <div className="space-y-6">
    <AutoRefresh intervalMs={7000} />
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Estacionamento</h1><p className="mt-1 text-sm text-muted-foreground">Avise pela projeção quando o proprietário de um veículo precisar comparecer ao local.</p></div>
      {hasPermission(session.roles ?? [], "parking:projection:view") ? <Link href="/projecao" target="_blank" className="rounded-2xl border border-border px-4 py-3 text-sm">Abrir tela da projeção ↗</Link> : null}
    </header>
    {access.PARKING ? <ParkingNoticeForm /> : <p className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">Para enviar avisos, vincule seu membro a um ministério ativo com a equipe de avisos Estacionamento.</p>}
    <section className="rounded-3xl border border-border bg-card p-5"><h2 className="font-semibold">Histórico de avisos</h2><div className="mt-4 space-y-3">
      {history.map(m => <article key={m.id} className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-3"><strong>{m.plate} · {[m.vehicle, m.color].filter(Boolean).join(" · ")}</strong><span className="text-xs">{m.status === "PENDING" ? "Aguardando projeção" : "Visualizado"}</span></div><p className="mt-2 text-sm">{m.message}</p><p className="mt-1 text-xs text-muted-foreground">{m.location} · {m.sentAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {m.sentBy?.name ?? "Equipe"}</p></article>)}
      {!history.length ? <p className="text-sm text-muted-foreground">Nenhum aviso enviado.</p> : null}
    </div></section>
  </div>;
}
