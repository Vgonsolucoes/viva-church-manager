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
import type {
  MemberType as PrismaMemberType,
  RoleKey as PrismaRoleKey,
} from "@/generated/prisma/client";
import { createNotificationCampaign } from "@/server/notifications";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
});

const allRoles = [
  "SUPER_ADMIN",
  "PASTOR_PRESIDENTE",
  "PASTOR",
  "MINISTRY_LEADER",
  "CELL_LEADER",
  "VOLUNTEER",
  "MEMBER",
  "FINANCE",
  "SECRETARY",
  "RECEPTION",
  "KIDS_MINISTRY",
  "PARKING",
] as const;
const roleSet: ReadonlySet<string> = new Set(allRoles);
const allMemberTypes = [
  "MEMBER",
  "VISITOR",
  "NEW_MEMBER",
  "LEADER",
  "VOLUNTEER",
  "DISCIPLER",
] as const;
const memberTypeSet: ReadonlySet<string> = new Set(allMemberTypes);

async function createNotification(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  const targetRoles = formData.getAll("targetRoles").map((v) => String(v));
  const targetMemberTypes = formData.getAll("targetMemberTypes").map((v) => String(v));
  const roles = targetRoles.length ? targetRoles : ["MEMBER"];
  const prismaRoles = roles.filter((r): r is PrismaRoleKey => roleSet.has(r));
  const prismaMemberTypes = targetMemberTypes.filter(
    (t): t is PrismaMemberType => memberTypeSet.has(t),
  );

  const notification = await createNotificationCampaign({
    title: parsed.data.title,
    body: parsed.data.body,
    createdById: session?.uid ?? null,
    targetRoles: prismaRoles,
    targetMemberTypes: prismaMemberTypes,
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Notification",
    entityId: notification.id,
    after: {
      id: notification.id,
      title: notification.title,
      targetRoles: prismaRoles,
      targetMemberTypes: prismaMemberTypes,
    },
  });

  revalidatePath("/admin/notifications");
}

const markReadSchema = z.object({
  deliveryId: z.string().min(1),
});

async function markRead(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = markReadSchema.safeParse({ deliveryId: formData.get("deliveryId") });
  if (!parsed.success) return;

  await prisma.notificationDelivery.update({
    where: { id: parsed.data.deliveryId },
    data: { readAt: new Date() },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "MARK_READ",
    entityType: "NotificationDelivery",
    entityId: parsed.data.deliveryId,
  });

  revalidatePath("/admin/notifications");
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  const rows = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { deliveries: true },
  });

  const myDeliveries = session?.uid
    ? await prisma.notificationDelivery.findMany({
        where: { userId: session.uid },
        orderBy: { deliveredAt: "desc" },
        take: 20,
        include: { notification: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Notificações</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Envie comunicados in-app para perfis (membros, voluntários, líderes).
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Últimas campanhas</div>
            <div className="text-xs text-muted-foreground">{rows.length} exibidas</div>
          </div>
          <div className="mt-4 space-y-3">
            {rows.length ? (
              rows.map((n) => (
                <div key={n.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{n.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(n.createdAt)}{" "}
                        • Entregas: {n.deliveries.length}
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">{n.body}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {n.targetRoles.map((r) => (
                          <Badge key={r}>{r}</Badge>
                        ))}
                        {n.targetMemberTypes.map((t) => (
                          <Badge key={t} className="bg-[rgba(88,167,255,0.10)]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge className="shrink-0">{n.channel}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhuma notificação enviada ainda.
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <div className="text-sm font-medium">Minhas notificações</div>
            <div className="text-xs text-muted-foreground">{myDeliveries.length} exibidas</div>
          </div>
          <div className="mt-4 space-y-2">
            {myDeliveries.length ? (
              myDeliveries.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{d.notification.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d.deliveredAt)}
                    </div>
                  </div>
                  {d.readAt ? (
                    <Badge>Lido</Badge>
                  ) : (
                    <form action={markRead}>
                      <input type="hidden" name="deliveryId" value={d.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Marcar como lida
                      </Button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhuma notificação para você.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Nova notificação</div>
          <form action={createNotification} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Título</div>
              <Input name="title" required placeholder="Ex: Culto especial hoje" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Mensagem</div>
              <textarea
                name="body"
                required
                className="min-h-28 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="Digite o comunicado..."
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Perfis (alvo)</div>
              <select
                name="targetRoles"
                multiple
                className="h-40 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {allRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground">
                Se não selecionar, envia para MEMBER.
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Tipos de membro</div>
              <select
                name="targetMemberTypes"
                multiple
                className="h-32 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {allMemberTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground">
                Permite avisar também visitantes e novos membros com acesso ao sistema.
              </div>
            </div>
            <Button className="w-full" type="submit">
              Enviar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
