import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { getArrivalConfig } from "@/server/service-arrival";
import { arrivalWindow, volunteerArrivalStatus } from "@/lib/service-arrival";
import { churchDateKey, churchDateTime } from "@/lib/weekly-services";
import { ensureWeeklyServices } from "@/server/weekly-services";
import { ensureStaffingSchedules } from "@/server/staffing";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/app/(admin)/admin/cells/[id]/SubmitButton";
import { AutoRefresh } from "../kids/checkins/AutoRefresh";
import { ArrivalChart } from "./ArrivalChart";
import {
  confirmVolunteerArrival,
  saveArrivalSettings,
  toggleServiceGeo,
} from "./actions";

export const dynamic = "force-dynamic";
const time = (value: Date) =>
  value.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function ServiceDirectionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; service?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (
    !session?.uid ||
    !hasPermission(session.permissions ?? [], "service-direction:read")
  )
    redirect("/admin");
  const params = await searchParams;
  const now = new Date();
  const checkedDay = z.iso.date().safeParse(params.date);
  const day = checkedDay.success ? checkedDay.data : churchDateKey(now);
  const nextDay = new Date(`${day}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayRange = {
    gte: churchDateTime(day, "00:00"),
    lt: churchDateTime(nextDay.toISOString().slice(0, 10), "00:00"),
  };
  await ensureWeeklyServices(now);
  await ensureStaffingSchedules(now);
  const [events, config] = await Promise.all([
    prisma.event.findMany({
      where: { type: "SERVICE", startsAt: dayRange },
      orderBy: { startsAt: "asc" },
      include: { serviceDecision: true },
    }),
    getArrivalConfig(),
  ]);
  const event =
    events.find((row) => row.id === params.service) ??
    events.find(
      (row) =>
        now >= arrivalWindow(row, config).from &&
        now <= arrivalWindow(row, config).to,
    ) ??
    events.find((row) => row.startsAt >= now) ??
    events[events.length - 1];
  const canWrite = hasPermission(
    session.permissions ?? [],
    "service-direction:write",
  );
  const canConfigure = hasPermission(
    session.permissions ?? [],
    "settings:manage",
  );
  const window = event ? arrivalWindow(event, config) : null;
  const [
    schedules,
    presence,
    newMembers,
    kids,
    lost,
    parking,
    parkingFlow,
    raffles,
  ] = await Promise.all([
    event
      ? prisma.schedule.findMany({
          where: { eventId: event.id },
          include: {
            ministry: true,
            assignments: {
              where: { status: { not: "DECLINED" } },
              include: {
                ministry: true,
                volunteer: {
                  include: {
                    member: {
                      select: {
                        id: true,
                        fullName: true,
                        arrivalConsent: { select: { enabled: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [],
    event
      ? prisma.servicePresence.findMany({
          where: { eventId: event.id },
          select: {
            memberId: true,
            arrivedAt: true,
            leftAt: true,
            method: true,
          },
        })
      : [],
    prisma.member.count({ where: { createdAt: dayRange } }),
    window
      ? prisma.childCheckIn.findMany({
          where: { checkInAt: { gte: window.from, lt: window.to } },
          select: { childId: true, status: true },
        })
      : [],
    prisma.lostFoundItem.findMany({
      where: { foundAtDate: dayRange },
      orderBy: { foundAtDate: "desc" },
      take: 12,
      select: { id: true, title: true, status: true, foundAtLocation: true },
    }),
    window
      ? prisma.parkingProjectionMessage.findMany({
          where: { sentAt: { gte: window.from, lt: window.to } },
          orderBy: { sentAt: "desc" },
          take: 20,
        })
      : [],
    window
      ? prisma.parkingFlow.findMany({
          where: { occurredAt: { gte: window.from, lt: window.to } },
          orderBy: { occurredAt: "desc" },
          take: 20,
        })
      : [],
    prisma.raffleResult.findMany({
      where: { recordedAt: dayRange },
      include: { raffle: { select: { title: true, prize: true } } },
    }),
  ]);
  const arrivals = new Map(presence.map((row) => [row.memberId, row]));
  const uniqueVolunteers = new Map<
    string,
    {
      name: string;
      arrivedAt: Date | null;
      enabled: boolean;
      ministries: Set<string>;
      roles: Set<string>;
    }
  >();
  const ministries = new Map<string, { name: string; people: Set<string> }>();
  for (const schedule of schedules) {
    for (const assignment of schedule.assignments) {
      const member = assignment.volunteer.member;
      const ministry = assignment.ministry ?? schedule.ministry;
      const ministryId = ministry?.id ?? "unassigned";
      const ministryName = ministry?.name ?? "Sem ministério";
      const team = ministries.get(ministryId) ?? {
        name: ministryName,
        people: new Set<string>(),
      };
      team.people.add(member.id);
      ministries.set(ministryId, team);
      const person = uniqueVolunteers.get(member.id) ?? {
        name: member.fullName,
        arrivedAt: arrivals.get(member.id)?.arrivedAt ?? null,
        enabled: member.arrivalConsent?.enabled ?? false,
        ministries: new Set<string>(),
        roles: new Set<string>(),
      };
      person.ministries.add(ministryName);
      person.roles.add(assignment.roleName);
      uniqueVolunteers.set(member.id, person);
    }
  }
  const people = [...uniqueVolunteers.entries()].map(([id, person]) => ({
    id,
    ...person,
    status: volunteerArrivalStatus(
      person.arrivedAt,
      event?.startsAt ?? now,
      now,
    ),
  }));
  const counts = {
    arrived: people.filter((p) => p.status === "ARRIVED").length,
    waiting: people.filter((p) => p.status === "WAITING").length,
    absent: people.filter((p) => p.status === "ABSENT").length,
  };
  const teamChart = [...ministries.values()].map((ministry) => {
    const team = people.filter((p) => ministry.people.has(p.id));
    return {
      name: ministry.name,
      arrived: team.filter((p) => p.status === "ARRIVED").length,
      waiting: team.filter((p) => p.status === "WAITING").length,
      absent: team.filter((p) => p.status === "ABSENT").length,
    };
  });
  const detected = presence.filter((row) => row.method === "GEO");
  const childCount = new Set(kids.map((row) => row.childId)).size;
  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={15000} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Direção de Culto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumo do culto, equipe e movimento da igreja.
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            Data
            <Input name="date" type="date" defaultValue={day} required />
          </label>
          {events.length ? (
            <label className="grid gap-1 text-sm">
              Culto
              <select
                name="service"
                defaultValue={event?.id}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {events.map((row) => (
                  <option key={row.id} value={row.id}>
                    {time(row.startsAt)} · {row.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button type="submit" variant="secondary">
            Consultar
          </Button>
        </form>
      </header>
      {params.status === "invalid-settings" ? (
        <p role="alert">
          Confira as coordenadas, o raio e os horários da igreja.
        </p>
      ) : null}
      {params.status === "settings-saved" ? (
        <p role="status">
          Configuração salva. Atualize a tela de chegada no aplicativo para
          receber a nova área.
        </p>
      ) : null}
      {!config.enabled ? (
        <Card className="p-4 text-sm">
          O check-in por localização está desativado na configuração da igreja.
        </Card>
      ) : null}
      {event ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">{event.name}</h2>
              <p className="text-sm text-muted-foreground">
                {time(event.startsAt)} · {event.location ?? config.address}
              </p>
            </div>
            {canWrite ? (
              <form
                action={toggleServiceGeo}
                className="flex items-center gap-3"
              >
                <input type="hidden" name="eventId" value={event.id} />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={event.geoCheckIn}
                  />
                  Check-in por localização neste culto
                </label>
                <SubmitButton size="sm" variant="secondary">
                  Salvar
                </SubmitButton>
              </form>
            ) : (
              <Badge>
                {event.geoCheckIn
                  ? "Check-in habilitado"
                  : "Check-in desativado"}
              </Badge>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Escalados", people.length],
              ["Chegaram", counts.arrived],
              ["Aguardando chegada", counts.waiting],
              ["Faltas a conferir", counts.absent],
              ["Pessoas detectadas pelo app", detected.length],
              ["Crianças com check-in", childCount],
              ["Cadastros novos no dia", newMembers],
              [
                "Aceitaram Jesus",
                event.serviceDecision?.count ?? "Não informado",
              ],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {value}
                </p>
              </Card>
            ))}
          </div>
          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Chegada da equipe</h2>
              <Badge>{ministries.size} ministérios escalados</Badge>
            </div>
            <ArrivalChart {...counts} ministries={teamChart} />
            <p className="text-xs text-muted-foreground">
              Após 40 minutos do início, quem está sem chegada registrada é
              sinalizado como falta a conferir. A equipe pode confirmar
              manualmente quem chegou.
            </p>
          </Card>
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">Escala do culto</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2">Voluntário</th>
                    <th>Ministérios</th>
                    <th>Chegada</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">
                        {person.name}
                        <p className="text-xs font-normal text-muted-foreground">
                          {person.enabled
                            ? "Detecção autorizada"
                            : "Detecção automática não ativada"}
                        </p>
                      </td>
                      <td className="pr-4 text-muted-foreground">
                        {[...person.ministries].join(", ")}
                        <p className="text-xs text-muted-foreground">
                          {[...person.roles].join(", ")}
                        </p>
                      </td>
                      <td className="pr-4">
                        <Badge
                          className={
                            person.status === "ARRIVED"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : person.status === "ABSENT"
                                ? "bg-red-500/15 text-red-600"
                                : "bg-amber-500/15 text-amber-600"
                          }
                        >
                          {person.status === "ARRIVED"
                            ? `Chegou · ${time(person.arrivedAt!)}`
                            : person.status === "ABSENT"
                              ? "Faltou · sem check-in"
                              : "Aguardando"}
                        </Badge>
                      </td>
                      <td>
                        {canWrite && !person.arrivedAt ? (
                          <form action={confirmVolunteerArrival}>
                            <input
                              type="hidden"
                              name="eventId"
                              value={event.id}
                            />
                            <input
                              type="hidden"
                              name="memberId"
                              value={person.id}
                            />
                            <SubmitButton variant="outline" size="sm">
                              Confirmar chegada
                            </SubmitButton>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!people.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhum voluntário escalado neste culto.
              </p>
            ) : null}
            <Link
              href={`/admin/schedules?month=${day.slice(0, 7)}`}
              className="inline-block text-sm font-medium underline"
            >
              Consultar escalas
            </Link>
          </Card>
          <p className="text-xs text-muted-foreground">
            A presença detectada conta pessoas únicas pelo cadastro, com
            localização autorizada, dentro da área e da janela deste culto. Não
            representa o público total.{" "}
            {detected.filter((row) => row.leftAt).length} saídas foram
            detectadas.
          </p>
        </>
      ) : (
        <Card className="p-5">Nenhum culto cadastrado nesta data.</Card>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Achados e perdidos no dia</h2>
          {lost.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border p-3 text-sm"
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.foundAtLocation} ·{" "}
                  {({ WAITING_PICKUP: "Aguardando retirada", DELIVERED: "Entregue", DISCARDED: "Descartado" })[item.status]}
              </p>
            </div>
          ))}
          {!lost.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item registrado.
            </p>
          ) : null}
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Estacionamento durante o culto</h2>
          {parking.map((notice) => (
            <div
              key={notice.id}
              className="rounded-xl border border-border p-3 text-sm"
            >
              <p className="font-medium">
                {notice.plate} · {time(notice.sentAt)}
              </p>
              <p>{notice.message}</p>
              <p className="text-xs text-muted-foreground">{notice.location}</p>
            </div>
          ))}
          {parkingFlow.map((flow) => (
            <p
              key={flow.id}
              className="rounded-xl border border-border p-3 text-sm"
            >
              {time(flow.occurredAt)} · Entradas {flow.vehiclesIn} · Saídas{" "}
              {flow.vehiclesOut}
              {flow.capacityAlert ? " · Alerta de lotação" : ""}
              {flow.notes ? ` · ${flow.notes}` : ""}
            </p>
          ))}
          {!parking.length && !parkingFlow.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ocorrência registrada.
            </p>
          ) : null}
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Sorteios realizados no dia</h2>
          {raffles.map((result) => (
            <div
              key={result.raffleId}
              className="rounded-xl border border-border p-3 text-sm"
            >
              <p className="font-medium">{result.raffle.title}</p>
              <p>
                {result.raffle.prize} · Número {result.winningNumber}
              </p>
              <p className="text-muted-foreground">{result.winnerName}</p>
            </div>
          ))}
          {!raffles.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum sorteio realizado.
            </p>
          ) : null}
        </Card>
      </div>
      {canConfigure ? (
        <Card className="p-5">
          <details className="space-y-4">
            <summary className="cursor-pointer font-semibold">
              Configuração da chegada na igreja
            </summary>
            <form
              action={saveArrivalSettings}
              className="grid gap-3 md:grid-cols-2"
            >
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={config.enabled}
                />
                Ativar check-in por localização
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                Endereço
                <Input name="address" defaultValue={config.address} required />
              </label>
              <label className="grid gap-1 text-sm">
                Latitude
                <Input
                  name="latitude"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  defaultValue={config.latitude ?? ""}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Longitude
                <Input
                  name="longitude"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  defaultValue={config.longitude ?? ""}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Raio em metros
                <Input
                  name="radiusMeters"
                  type="number"
                  min={50}
                  max={1000}
                  defaultValue={config.radiusMeters}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Abrir quantos minutos antes
                <Input
                  name="beforeMinutes"
                  type="number"
                  min={0}
                  max={180}
                  defaultValue={config.beforeMinutes}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Duração padrão em minutos
                <Input
                  name="durationMinutes"
                  type="number"
                  min={40}
                  max={360}
                  defaultValue={config.durationMinutes}
                  required
                />
              </label>
              <div className="self-end">
                <SubmitButton>Salvar configuração</SubmitButton>
              </div>
            </form>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
