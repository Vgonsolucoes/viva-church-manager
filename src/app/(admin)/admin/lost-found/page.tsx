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

const createSchema = z.object({
  title: z.string().min(2),
  foundAtLocation: z.string().optional().or(z.literal("")),
  foundAtDate: z.string().optional().or(z.literal("")),
});

async function createItem(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    foundAtLocation: formData.get("foundAtLocation"),
    foundAtDate: formData.get("foundAtDate"),
  });
  if (!parsed.success) return;

  const item = await prisma.lostFoundItem.create({
    data: {
      title: parsed.data.title.trim(),
      foundAtLocation: parsed.data.foundAtLocation ? parsed.data.foundAtLocation.trim() : null,
      foundAtDate: parsed.data.foundAtDate ? new Date(parsed.data.foundAtDate) : new Date(),
      createdById: session?.uid ?? null,
      status: "WAITING_PICKUP",
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "LostFoundItem",
    entityId: item.id,
    after: { id: item.id, title: item.title, status: item.status },
  });

  revalidatePath("/admin/lost-found");
}

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["WAITING_PICKUP", "DELIVERED", "DISCARDED"]),
  pickedUpByName: z.string().optional().or(z.literal("")),
});

async function updateStatus(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    pickedUpByName: formData.get("pickedUpByName"),
  });
  if (!parsed.success) return;

  const before = await prisma.lostFoundItem.findUnique({ where: { id: parsed.data.id } });
  if (!before) return;

  const item = await prisma.lostFoundItem.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      pickedUpByName:
        parsed.data.status === "DELIVERED" && parsed.data.pickedUpByName
          ? parsed.data.pickedUpByName.trim()
          : null,
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "UPDATE_STATUS",
    entityType: "LostFoundItem",
    entityId: item.id,
    before: { status: before.status, pickedUpByName: before.pickedUpByName },
    after: { status: item.status, pickedUpByName: item.pickedUpByName },
  });

  revalidatePath("/admin/lost-found");
}

export default async function LostFoundPage() {
  const items = await prisma.lostFoundItem.findMany({
    orderBy: { foundAtDate: "desc" },
    take: 80,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Achados e Perdidos</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Registre itens encontrados e acompanhe retirada/entrega.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Itens</div>
            <div className="text-xs text-muted-foreground">{items.length} exibidos</div>
          </div>
          <div className="mt-4 space-y-3">
            {items.length ? (
              items.map((i) => (
                <div key={i.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{i.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(i.foundAtDate)}
                        {i.foundAtLocation ? ` • ${i.foundAtLocation}` : ""}
                        {i.pickedUpByName ? ` • Retirado por: ${i.pickedUpByName}` : ""}
                      </div>
                    </div>
                    <Badge className="shrink-0">{i.status}</Badge>
                  </div>

                  <form action={updateStatus} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                    <input type="hidden" name="id" value={i.id} />
                    <select
                      name="status"
                      defaultValue={i.status}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      <option value="WAITING_PICKUP">Aguardando retirada</option>
                      <option value="DELIVERED">Entregue</option>
                      <option value="DISCARDED">Descartado</option>
                    </select>
                    <Input name="pickedUpByName" placeholder="Quem retirou (se entregue)" className="md:col-span-2" />
                    <Button type="submit" variant="secondary">
                      Atualizar
                    </Button>
                  </form>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum item registrado.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Novo item</div>
          <form action={createItem} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Item encontrado</div>
              <Input name="title" placeholder="Ex: Chave com chaveiro" required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Local</div>
              <Input name="foundAtLocation" placeholder="Ex: Hall" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Data</div>
              <Input name="foundAtDate" type="date" />
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

