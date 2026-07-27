import { endOfMonth, startOfMonth } from "date-fns";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const createTxSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  kind: z.enum(["TITHE", "OFFERING", "DONATION", "CAMPAIGN", "PROJECT", "OTHER"]).default("OTHER"),
  amount: z.string().min(1),
  category: z.string().optional().or(z.literal("")),
  costCenter: z.string().optional().or(z.literal("")),
  ministryId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  occurredAt: z.string().optional().or(z.literal("")),
});

function parseMoneyToCents(raw: string) {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

async function createTransaction(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createTxSchema.safeParse({
    direction: formData.get("direction"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    costCenter: formData.get("costCenter"),
    ministryId: formData.get("ministryId"),
    projectId: formData.get("projectId"),
    description: formData.get("description"),
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) return;

  const cents = parseMoneyToCents(parsed.data.amount);
  if (cents === null || cents <= 0) return;

  const tx = await prisma.financeTransaction.create({
    data: {
      direction: parsed.data.direction,
      kind: parsed.data.kind,
      amountCents: cents,
      category: parsed.data.category ? parsed.data.category.trim() : null,
      costCenter: parsed.data.costCenter ? parsed.data.costCenter.trim() : null,
      ministryId: parsed.data.ministryId ? parsed.data.ministryId : null,
      projectId: parsed.data.projectId ? parsed.data.projectId : null,
      description: parsed.data.description ? parsed.data.description.trim() : null,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      createdById: session?.uid ?? null,
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "FinanceTransaction",
    entityId: tx.id,
    after: {
      id: tx.id,
      direction: tx.direction,
      kind: tx.kind,
      amountCents: tx.amountCents,
      occurredAt: tx.occurredAt,
    },
  });

  revalidatePath("/admin/finance");
}

export default async function FinancePage() {
  const now = new Date();
  const range = { from: startOfMonth(now), to: endOfMonth(now) };

  const [ministries, projects, transactions, sumIn, sumOut] = await Promise.all([
    prisma.ministry.findMany({ orderBy: { name: "asc" } }),
    prisma.fundraisingProject.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.financeTransaction.findMany({
      where: { occurredAt: { gte: range.from, lte: range.to } },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { ministry: true, project: true, event: true },
    }),
    prisma.financeTransaction.aggregate({
      _sum: { amountCents: true },
      where: { direction: "IN", occurredAt: { gte: range.from, lte: range.to } },
    }),
    prisma.financeTransaction.aggregate({
      _sum: { amountCents: true },
      where: { direction: "OUT", occurredAt: { gte: range.from, lte: range.to } },
    }),
  ]);

  const inCents = sumIn._sum.amountCents ?? 0;
  const outCents = sumOut._sum.amountCents ?? 0;
  const balanceCents = inCents - outCents;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Financeiro</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Entradas, saídas, dízimos, ofertas e relatórios mensais.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Movimentações (mês)</div>
            <div className="text-xs text-muted-foreground">
              Saldo{" "}
              {(balanceCents / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge>
              Entradas{" "}
              {(inCents / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </Badge>
            <Badge>
              Saídas{" "}
              {(outCents / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </Badge>
          </div>

          <div className="mt-4 divide-y divide-border">
            {transactions.length ? (
              transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {t.description ?? t.category ?? "Movimentação"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                        t.occurredAt,
                      )}{" "}
                      • {t.kind}
                      {t.category ? ` • ${t.category}` : ""}
                      {t.event?.name ? ` • Evento: ${t.event.name}` : ""}
                      {t.paymentMethod
                        ? ` • ${t.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}`
                        : ""}
                      {t.ministry?.name ? ` • ${t.ministry.name}` : ""}
                      {t.project?.name ? ` • ${t.project.name}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {(t.amountCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </div>
                    <Badge className={t.direction === "IN" ? "" : "opacity-70"}>
                      {t.direction}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                Nenhuma movimentação registrada neste mês.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Nova movimentação</div>
          <form action={createTransaction} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Direção</div>
              <select
                name="direction"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue="IN"
              >
                <option value="IN">Entrada</option>
                <option value="OUT">Saída</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Tipo</div>
              <select
                name="kind"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue="OTHER"
              >
                <option value="TITHE">Dízimo</option>
                <option value="OFFERING">Oferta</option>
                <option value="DONATION">Doação</option>
                <option value="CAMPAIGN">Campanha</option>
                <option value="PROJECT">Projeto</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Valor (R$)</div>
              <Input name="amount" placeholder="0,00" required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Categoria</div>
              <Input name="category" placeholder="Ex: aluguel, luz, manutenção" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Centro de custo</div>
              <Input name="costCenter" placeholder="Ex: Operacional" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Ministério</div>
              <select
                name="ministryId"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">(opcional)</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Projeto</div>
              <select
                name="projectId"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">(opcional)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Descrição</div>
              <Input name="description" placeholder="Ex: Oferta culto domingo" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Data</div>
              <Input name="occurredAt" type="date" />
            </div>
            <Button className="w-full" type="submit">
              Registrar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
