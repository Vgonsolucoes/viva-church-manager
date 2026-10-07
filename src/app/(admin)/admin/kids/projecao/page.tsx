import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { getActiveKidsService } from "@/server/kids-services";
import { closeEndedKidsSessions } from "@/server/kids-close";
import { KIDS_PROJECTION_STATUS } from "@/server/kids-projection";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KidsSubNav } from "../KidsSubNav";
import { CallGuardianForm } from "./CallGuardianForm";
import { AutoRefresh } from "../checkins/AutoRefresh";

export const dynamic = "force-dynamic";

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
});

export default async function KidsProjecaoAdminPage() {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as RoleKey[];
  const canSend = hasPermission(roles, "kids:projection:send");
  const canViewScreen = hasPermission(roles, "kids:projection:view");

  // Lazy close: crianças de cultos já encerrados não devem ser elegíveis para chamado.
  await closeEndedKidsSessions();

  const activeResult = await getActiveKidsService();
  const activeService = activeResult.ok ? activeResult.service : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Crianças elegíveis para chamado: check-in ativo no culto atual
  // (ou registros de hoje quando não há culto em andamento).
  const checkedIn = await prisma.childCheckIn.findMany({
    where: {
      status: "CHECKED_IN",
      ...(activeService
        ? { serviceScheduleId: activeService.id }
        : { checkInAt: { gte: todayStart } }),
    },
    include: { child: { select: { id: true, fullName: true } } },
    orderBy: { checkInAt: "asc" },
  });
  const childOptions = checkedIn.map((c) => ({
    id: c.child.id,
    fullName: c.child.fullName,
  }));

  const history = await prisma.kidsProjectionMessage.findMany({
    orderBy: { sentAt: "desc" },
    take: 50,
    include: {
      child: { select: { fullName: true } },
      sentBy: { select: { name: true, email: true } },
      serviceSchedule: { select: { name: true } },
    },
  });

  const pendingCount = history.filter((m) => m.status === KIDS_PROJECTION_STATUS.PENDING).length;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={7000} />

      <div>
        <div className="text-xl font-semibold tracking-tight">Ministério Infantil</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Comunicação do Kids com a equipe de projeção.
        </div>
      </div>

      <KidsSubNav />

      {pendingCount > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Há {pendingCount} {pendingCount === 1 ? "mensagem aguardando" : "mensagens aguardando"}{" "}
          visualização na tela da projeção.
        </div>
      ) : null}

      {canViewScreen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="text-sm">
            <span className="font-medium">Tela da projeção:</span>{" "}
            <span className="text-muted-foreground">
              abra em uma aba dedicada no computador do telão (login com perfil
              de Projeção) e deixe em tela cheia durante o culto.
            </span>
          </div>
          <Link href="/kids/projecao" target="_blank">
            <Button type="button" variant="secondary" size="sm">
              Abrir tela da projeção ↗
            </Button>
          </Link>
        </div>
      ) : null}

      {canSend ? (
        childOptions.length > 0 ? (
          <CallGuardianForm children={childOptions} />
        ) : (
          <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Nenhuma criança com check-in ativo {activeService ? "neste culto" : "hoje"}. O chamado
            de responsável fica disponível quando houver crianças no Kids.
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Você pode acompanhar o histórico abaixo, mas somente voluntários do
          Kids podem enviar chamados à projeção.
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Histórico de mensagens</div>
          <Badge>{history.length} {history.length === 1 ? "registro" : "registros"}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {history.length ? (
            history.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{m.child.fullName}</div>
                  <div className="mt-0.5 text-sm text-foreground/90">“{m.message}”</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {timeFmt.format(m.sentAt)}
                    {m.serviceSchedule ? ` • ${m.serviceSchedule.name}` : ""}
                    {" • enviado por "}
                    {m.sentBy?.name ?? m.sentBy?.email ?? "—"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {m.status === KIDS_PROJECTION_STATUS.PENDING ? (
                    <Badge className="border border-amber-500/40 bg-amber-500/15 text-amber-100">
                      Aguardando
                    </Badge>
                  ) : (
                    <>
                      <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-100">
                        Visualizado
                      </Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        às {m.viewedAt ? timeFmt.format(m.viewedAt) : "—"}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhuma mensagem enviada à projeção ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
