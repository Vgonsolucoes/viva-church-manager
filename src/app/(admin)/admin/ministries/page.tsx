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

const createMinistrySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
});

async function createMinistry(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createMinistrySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return;

  const ministry = await prisma.ministry.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description ? parsed.data.description.trim() : null,
      active: true,
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Ministry",
    entityId: ministry.id,
    after: { id: ministry.id, name: ministry.name, active: ministry.active },
  });

  revalidatePath("/admin/ministries");
}

export default async function MinistriesPage() {
  const ministries = await prisma.ministry.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { volunteers: true, members: true, schedules: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Ministérios</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Organização por equipes, escalas e responsabilidades.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="text-sm font-semibold">Ministérios cadastrados</div>
            <div className="text-xs text-muted-foreground">{ministries.length} no total</div>
          </div>
          <div className="px-6 pb-6 pt-4 space-y-2">
            {ministries.length ? (
              ministries.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-3xl border border-border/80 bg-muted/10 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{m.name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {m.description ?? "Sem descrição"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-muted/10">{m._count.members} membros</Badge>
                    <Badge className="bg-muted/10">{m._count.volunteers} voluntários</Badge>
                    <Badge className="bg-muted/10">{m._count.schedules} escalas</Badge>
                    {m.active ? (
                      <Badge className="border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.10)] text-foreground">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge className="border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.10)] text-foreground">
                        Inativo
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum ministério cadastrado.</div>
            )}
          </div>
        </Card>

        <Card>
          <div className="px-6 pt-6">
            <div className="text-sm font-semibold">Novo ministério</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Crie um ministério para vincular membros, voluntários e escalas.
            </div>
          </div>
          <form action={createMinistry} className="px-6 pb-6 pt-4 space-y-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground">Nome</div>
              <Input name="name" placeholder="Ex: Louvor" required />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground">Descrição</div>
              <Input name="description" placeholder="Opcional" />
            </div>
            <Button type="submit" className="w-full">
              Criar ministério
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

