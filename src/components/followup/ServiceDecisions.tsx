import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertWebPermission } from "@/server/access-control";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { ensureWeeklyServices } from "@/server/weekly-services";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/app/(admin)/admin/cells/[id]/SubmitButton";

async function saveDecisions(form: FormData) {
  "use server";
  const session = await assertWebPermission("followup:write");
  const input = z
    .object({
      eventId: z.string().min(1),
      count: z.coerce.number().int().min(0).max(100000),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return;
  const event = await prisma.event.findUnique({
    where: { id: input.data.eventId },
    select: { type: true },
  });
  if (event?.type !== "SERVICE") return;
  await prisma.serviceDecision.upsert({
    where: { eventId: input.data.eventId },
    create: { ...input.data, updatedById: session.uid },
    update: { count: input.data.count, updatedById: session.uid },
  });
  await logAudit({
    actorUserId: session.uid,
    action: "UPDATE",
    entityType: "ServiceDecision",
    entityId: input.data.eventId,
    after: { count: input.data.count },
  });
  revalidatePath("/admin/acompanhamento");
  revalidatePath("/admin/direcao-culto");
}

export async function ServiceDecisions({ canWrite }: { canWrite: boolean }) {
  await ensureWeeklyServices();
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      type: "SERVICE",
      startsAt: {
        gte: new Date(now.getTime() - 30 * 86400000),
        lt: new Date(now.getTime() + 86400000),
      },
    },
    orderBy: { startsAt: "desc" },
    include: { serviceDecision: true },
    take: 50,
  });
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold">Acolher · Pessoas que aceitaram Jesus</h2>
      <p className="text-sm text-muted-foreground">
        Informe o total por culto. Uma correção substitui o total anterior.
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Registrar ou corrigir decisões por culto
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {events.map((event) => (
            <form
              key={event.id}
              action={saveDecisions}
              className="space-y-2 rounded-xl border border-border p-3"
            >
              <input type="hidden" name="eventId" value={event.id} />
              <p className="text-sm font-medium">
                {event.name} ·{" "}
                {event.startsAt.toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
              <label className="grid gap-1 text-sm">
                Total de pessoas que aceitaram Jesus
                <Input
                  name="count"
                  type="number"
                  min={0}
                  max={100000}
                  defaultValue={event.serviceDecision?.count ?? 0}
                  required
                  disabled={!canWrite}
                />
              </label>
              {canWrite ? (
                <SubmitButton size="sm" variant="secondary">
                  Salvar total
                </SubmitButton>
              ) : null}
            </form>
          ))}
          {!events.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum culto cadastrado no período.
            </p>
          ) : null}
        </div>
      </details>
    </Card>
  );
}
