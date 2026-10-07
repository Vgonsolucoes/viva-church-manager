import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { getActiveKidsService, KIDS_WEEKDAY_LABELS, NO_ACTIVE_SERVICE_MESSAGE } from "@/server/kids-services";
import { closeEndedKidsSessions, KIDS_CLOSE_REASON_SERVICE_ENDED } from "@/server/kids-close";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SafeAvatarImage } from "@/components/ui/SafeAvatarImage";
import { KidsSubNav } from "../KidsSubNav";
import { AutoRefresh } from "./AutoRefresh";
import { checkOutFromPanel } from "./actions";

export const dynamic = "force-dynamic";

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
});

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function KidsCheckinsPage() {
  const session = await getServerSession(authOptions);
  const canWrite = hasPermission((session?.roles ?? []) as RoleKey[], "kids:write");

  // Lazy close: encerra administrativamente sessões de cultos já finalizados
  // antes de montar a visão do painel.
  await closeEndedKidsSessions();

  const activeResult = await getActiveKidsService();
  const activeService = activeResult.ok ? activeResult.service : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Culto ativo: check-ins vinculados a ele. Sem culto ativo: visão do dia
  // (somente leitura), para acompanhar registros manuais/legados.
  const checkIns = await prisma.childCheckIn.findMany({
    where: activeService
      ? { serviceScheduleId: activeService.id, status: "CHECKED_IN" }
      : { checkInAt: { gte: todayStart } },
    include: {
      child: {
        include: { guardians: { select: { fullName: true, phone: true }, take: 2 } },
      },
    },
    orderBy: { checkInAt: "asc" },
  });

  const present = checkIns.filter((c) => c.status === "CHECKED_IN");

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={5000} />

      <div>
        <div className="text-xl font-semibold tracking-tight">Ministério Infantil</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Painel operacional dos check-ins do culto.
        </div>
      </div>

      <KidsSubNav />

      {activeService ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
            {activeService.name}
          </div>
          <div className="mt-0.5 text-xs text-emerald-100/80">
            {KIDS_WEEKDAY_LABELS[activeService.dayOfWeek]} • {activeService.startTime} →{" "}
            {activeService.endTime}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {NO_ACTIVE_SERVICE_MESSAGE} Exibindo os registros de hoje.
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Crianças no Kids</div>
          <Badge>{present.length} {present.length === 1 ? "criança" : "crianças"}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {checkIns.length ? (
            checkIns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {c.child.photoUrl ? (
                    <SafeAvatarImage
                      src={c.child.photoUrl}
                      alt={c.child.fullName}
                      className="h-11 w-11 rounded-full object-cover"
                      fallback={
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {initialsOf(c.child.fullName)}
                        </div>
                      }
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {initialsOf(c.child.fullName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.child.fullName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.child.guardians[0]?.fullName ?? "Responsável não informado"}
                      {c.child.guardians[0]?.phone ? ` • ${c.child.guardians[0].phone}` : ""}
                    </div>
                    {c.status === "CHECKED_OUT" ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {c.closeReason === KIDS_CLOSE_REASON_SERVICE_ENDED
                          ? "Check-in encerrado automaticamente ao final do culto"
                          : `Check-out às ${c.checkOutAt ? timeFmt.format(c.checkOutAt) : "—"}`}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold">{timeFmt.format(c.checkInAt)}</div>
                    <div className="text-xs text-muted-foreground">cód. {c.pickupCode}</div>
                  </div>
                  {c.status === "CHECKED_IN" ? (
                    canWrite ? (
                      <form action={checkOutFromPanel}>
                        <input type="hidden" name="checkInId" value={c.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Check-out
                        </Button>
                      </form>
                    ) : (
                      <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-100">
                        No ambiente
                      </Badge>
                    )
                  ) : c.closeReason === KIDS_CLOSE_REASON_SERVICE_ENDED ? (
                    <Badge className="border border-amber-500/40 bg-amber-500/15 text-amber-100">
                      Sessão encerrada
                    </Badge>
                  ) : (
                    <Badge>Retirada</Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhuma criança com check-in {activeService ? "neste culto" : "hoje"}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
