import { endOfMonth, startOfMonth } from "date-fns";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function parseMoneyToCents(raw: string) {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

const upsertSchema = z.object({
  year: z.string().min(4),
  month: z.string().min(1),
  ministryId: z.string().min(1),
  planned: z.string().min(1),
});

async function upsertPlan(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = upsertSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    ministryId: formData.get("ministryId"),
    planned: formData.get("planned"),
  });
  if (!parsed.success) return;

  const plannedCents = parseMoneyToCents(parsed.data.planned);
  if (!plannedCents || plannedCents < 0) return;

  const year = Number(parsed.data.year);
  const month = Number(parsed.data.month);

  const existing = await prisma.budgetPlan.findFirst({
    where: { year, month, ministryId: parsed.data.ministryId, projectId: null },
  });

  const plan = existing
    ? await prisma.budgetPlan.update({
        where: { id: existing.id },
        data: { plannedCents },
      })
    : await prisma.budgetPlan.create({
        data: { year, month, ministryId: parsed.data.ministryId, plannedCents },
      });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "UPSERT",
    entityType: "BudgetPlan",
    entityId: plan.id,
    after: { id: plan.id, year: plan.year, month: plan.month, plannedCents: plan.plannedCents },
  });

  revalidatePath("/admin/budget");
}

export default async function BudgetPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [ministries, plans] = await Promise.all([
    prisma.ministry.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.budgetPlan.findMany({
      where: { year, month, projectId: null },
      orderBy: { plannedCents: "desc" },
      include: { ministry: true },
      take: 200,
    }),
  ]);

  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(from);

  const actualByMinistry = await prisma.financeTransaction.groupBy({
    by: ["ministryId"],
    where: {
      ministryId: { not: null },
      direction: "OUT",
      occurredAt: { gte: from, lte: to },
    },
    _sum: { amountCents: true },
  });

  const actualMap = new Map<string, number>();
  actualByMinistry.forEach((r) => {
    if (r.ministryId) actualMap.set(r.ministryId, r._sum.amountCents ?? 0);
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Plano Orçamentário</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Previsto x realizado por ministério (saídas do mês).
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              Orçamento • {String(month).padStart(2, "0")}/{year}
            </div>
            <div className="text-xs text-muted-foreground">{plans.length} itens</div>
          </div>

          <div className="mt-4 divide-y divide-border">
            {plans.length ? (
              plans.map((p) => {
                const actual = p.ministryId ? actualMap.get(p.ministryId) ?? 0 : 0;
                const diff = p.plannedCents - actual;
                const ok = diff >= 0;
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.ministry?.name ?? "—"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Previsto{" "}
                        {(p.plannedCents / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}{" "}
                        • Realizado{" "}
                        {(actual / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </div>
                    </div>
                    <Badge className={ok ? "" : "opacity-80"}>
                      {ok ? "OK" : "ESTOURO"} •{" "}
                      {(diff / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                Nenhum orçamento cadastrado para este mês.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Definir orçamento</div>
          <form action={upsertPlan} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Ano</div>
                <Input name="year" defaultValue={String(year)} required />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Mês</div>
                <Input name="month" defaultValue={String(month)} required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Ministério</div>
              <select
                name="ministryId"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecionar
                </option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Previsto (R$)</div>
              <Input name="planned" placeholder="0,00" required />
            </div>
            <Button className="w-full" type="submit">
              Salvar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
