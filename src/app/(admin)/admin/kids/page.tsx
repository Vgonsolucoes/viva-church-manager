import crypto from "crypto";
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

function pickupCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

const createChildSchema = z.object({
  fullName: z.string().min(2),
  birthDate: z.string().optional().or(z.literal("")),
  allergies: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  guardianName: z.string().min(2),
  guardianPhone: z.string().optional().or(z.literal("")),
});

async function createChild(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createChildSchema.safeParse({
    fullName: formData.get("fullName"),
    birthDate: formData.get("birthDate"),
    allergies: formData.get("allergies"),
    notes: formData.get("notes"),
    guardianName: formData.get("guardianName"),
    guardianPhone: formData.get("guardianPhone"),
  });
  if (!parsed.success) return;

  const child = await prisma.child.create({
    data: {
      fullName: parsed.data.fullName.trim(),
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
      allergies: parsed.data.allergies ? parsed.data.allergies.trim() : null,
      notes: parsed.data.notes ? parsed.data.notes.trim() : null,
      guardians: {
        create: {
          fullName: parsed.data.guardianName.trim(),
          phone: parsed.data.guardianPhone ? parsed.data.guardianPhone.trim() : null,
        },
      },
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Child",
    entityId: child.id,
    after: { id: child.id, fullName: child.fullName },
  });

  revalidatePath("/admin/kids");
}

const checkInSchema = z.object({
  childId: z.string().min(1),
});

async function checkIn(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = checkInSchema.safeParse({ childId: formData.get("childId") });
  if (!parsed.success) return;

  const row = await prisma.childCheckIn.create({
    data: {
      childId: parsed.data.childId,
      status: "CHECKED_IN",
      pickupCode: pickupCode(),
      createdById: session?.uid ?? null,
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CHECK_IN",
    entityType: "ChildCheckIn",
    entityId: row.id,
    after: { id: row.id, childId: row.childId, pickupCode: row.pickupCode },
  });

  revalidatePath("/admin/kids");
}

const checkOutSchema = z.object({
  checkInId: z.string().min(1),
});

async function checkOut(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = checkOutSchema.safeParse({ checkInId: formData.get("checkInId") });
  if (!parsed.success) return;

  const before = await prisma.childCheckIn.findUnique({ where: { id: parsed.data.checkInId } });
  if (!before) return;

  const row = await prisma.childCheckIn.update({
    where: { id: parsed.data.checkInId },
    data: { status: "CHECKED_OUT", checkOutAt: new Date() },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CHECK_OUT",
    entityType: "ChildCheckIn",
    entityId: row.id,
    before: { status: before.status },
    after: { status: row.status, checkOutAt: row.checkOutAt },
  });

  revalidatePath("/admin/kids");
}

export default async function KidsPage() {
  const [children, active, recent] = await Promise.all([
    prisma.child.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { guardians: true } }),
    prisma.childCheckIn.findMany({
      where: { status: "CHECKED_IN" },
      orderBy: { checkInAt: "desc" },
      take: 30,
      include: { child: true },
    }),
    prisma.childCheckIn.findMany({
      orderBy: { checkInAt: "desc" },
      take: 20,
      include: { child: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Ministério Infantil</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Cadastro de crianças, responsáveis e check-in/check-out com código de retirada.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Check-ins ativos</div>
            <div className="text-xs text-muted-foreground">{active.length} ativos</div>
          </div>
          <div className="mt-4 space-y-3">
            {active.length ? (
              active.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.child.fullName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Check-in{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(c.checkInAt)}{" "}
                      • Código: <span className="font-semibold text-foreground">{c.pickupCode}</span>
                    </div>
                  </div>
                  <form action={checkOut}>
                    <input type="hidden" name="checkInId" value={c.id} />
                    <Button type="submit" variant="secondary">
                      Check-out
                    </Button>
                  </form>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhuma criança em sala no momento.</div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm font-medium">Histórico recente</div>
            <div className="text-xs text-muted-foreground">{recent.length} registros</div>
          </div>
          <div className="mt-4 divide-y divide-border">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.child.fullName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(r.checkInAt)}
                    {r.checkOutAt
                      ? ` • saída ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(r.checkOutAt)}`
                      : ""}
                  </div>
                </div>
                <Badge className="shrink-0">{r.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-medium">Check-in</div>
            <form action={checkIn} className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Criança</div>
                <select
                  name="childId"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecionar
                  </option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <Button className="w-full" type="submit">
                Gerar check-in
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-medium">Cadastrar criança</div>
            <form action={createChild} className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Nome</div>
                <Input name="fullName" required />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Nascimento</div>
                <Input name="birthDate" type="date" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Restrições/alergias</div>
                <Input name="allergies" placeholder="Ex: glúten, lactose" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Observações</div>
                <Input name="notes" placeholder="Ex: necessidades especiais" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Responsável</div>
                <Input name="guardianName" required placeholder="Nome do responsável" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Telefone</div>
                <Input name="guardianPhone" placeholder="(00) 00000-0000" />
              </div>
              <Button className="w-full" type="submit">
                Cadastrar
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

