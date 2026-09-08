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
  imageUrl: z.string().url().or(z.string().length(0)).optional().nullable(),
  deepLink: z.string().optional().nullable(),
  scheduledAt: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || !isNaN(Date.parse(v)), { message: "Data/hora inválida" }),
  channel: z.enum(["IN_APP", "PUSH"]).default("IN_APP"),
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
const allTargetScopes = [
  "ALL",
  "ROLES",
  "MINISTRIES",
  "CELLS",
  "PEOPLE",
] as const;
const deepLinkOptions = [
  { label: "Início", value: "/(tabs)" },
  { label: "Agenda", value: "/(tabs)/agenda" },
  { label: "Escalas", value: "/(tabs)/escalas" },
  { label: "Eventos", value: "/(tabs)/eventos" },
  { label: "Células", value: "/(tabs)/celulas" },
  { label: "Rede", value: "/(tabs)/rede" },
  { label: "Discipulado", value: "/(tabs)/discipulado" },
  { label: "Carteirinha", value: "/carteirinha" },
  { label: "Igreja", value: "/igreja" },
  { label: "Notificações", value: "/(tabs)/notificacoes" },
  { label: "Perfil / Editar", value: "/perfil/editar" },
] as const;

async function createNotification(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    imageUrl: formData.get("imageUrl"),
    deepLink: formData.get("deepLink"),
    scheduledAt: formData.get("scheduledAt"),
    channel: formData.get("channel") ?? "IN_APP",
  });
  if (!parsed.success) return;

  const scope = String(formData.get("targetScope") ?? "ROLES");
  const rawTargetRoles = formData.getAll("targetRoles").map((v) => String(v));
  const rawTargetMemberTypes = formData.getAll("targetMemberTypes").map((v) => String(v));
  const targetMinistryIds = formData.getAll("targetMinistries").map((v) => String(v)).filter(Boolean);
  const targetCellIds = formData.getAll("targetCells").map((v) => String(v)).filter(Boolean);
  const targetPersonUserIds = formData.getAll("targetPeople").map((v) => String(v)).filter(Boolean);

  let targetRoles: string[] = [];
  if (scope === "ALL") {
    targetRoles = ["MEMBER", "VOLUNTEER", "PASTOR", "CELL_LEADER", "MINISTRY_LEADER", "FINANCE", "SECRETARY", "RECEPTION", "KIDS_MINISTRY", "PARKING", "PASTOR_PRESIDENTE", "SUPER_ADMIN"];
  } else if (scope === "ROLES") {
    targetRoles = rawTargetRoles.length ? rawTargetRoles : ["MEMBER"];
  }
  const prismaRoles = targetRoles.filter((r): r is PrismaRoleKey => roleSet.has(r));
  const prismaMemberTypes = rawTargetMemberTypes.filter(
    (t): t is PrismaMemberType => memberTypeSet.has(t),
  );

  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  const deepLink = parsed.data.deepLink || null;
  const imageUrl = parsed.data.imageUrl || null;
  const channel = parsed.data.channel;

  const targetUsersOverride =
    scope === "MINISTRIES" || scope === "CELLS" || scope === "PEOPLE"
      ? {
          userIds: scope === "PEOPLE" ? targetPersonUserIds : undefined,
          ministryIds: scope === "MINISTRIES" ? targetMinistryIds : undefined,
          cellIds: scope === "CELLS" ? targetCellIds : undefined,
        }
      : undefined;

  const notification = await createNotificationCampaign({
    title: parsed.data.title,
    body: parsed.data.body,
    createdById: session?.uid ?? null,
    targetRoles: prismaRoles,
    targetMemberTypes: prismaMemberTypes,
    channel,
    deepLink,
    scheduledAt,
    imageUrl,
    targetUsersOverride,
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
      scope,
      targetMinistryIds,
      targetCellIds,
      targetPersonUserIds,
      channel,
      deepLink,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      imageUrl,
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

  const ministries = await prisma.ministry.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const cells = await prisma.cell.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, leader: { select: { fullName: true } } },
  });
  const people = await prisma.member.findMany({
    orderBy: { fullName: "asc" },
    take: 200,
    select: {
      id: true,
      fullName: true,
      email: true,
      user: { select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">App Mobile / Notificações</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Envie comunicados in-app e push notifications para perfis, ministérios, células ou pessoas.
          Inclui título, mensagem, imagem, destino interno e agendamento.
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
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{n.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(n.createdAt)}{" "}
                        • Entregas: {n.deliveries.length}
                        {n.scheduledAt
                          ? ` • Agendada: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(n.scheduledAt)}`
                          : ""}
                        {n.deepLink ? ` • Deep link: ${n.deepLink}` : ""}
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{n.body}</div>
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
                  <div className="min-w-0 flex-1">
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
              <div className="text-xs font-medium text-muted-foreground">Canal</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <input type="radio" name="channel" value="IN_APP" defaultChecked className="accent-blue-500" />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <input type="radio" name="channel" value="PUSH" className="accent-blue-500" />
                  <span>Push (Mobile)</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Título</div>
              <Input name="title" required placeholder="Ex: Nova escala — Domingo às 19h" />
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
              <div className="text-xs font-medium text-muted-foreground">Imagem (URL opcional)</div>
              <Input name="imageUrl" placeholder="https://... (jpg/png)" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Destino interno (Deep Link)</div>
              <select name="deepLink" defaultValue="" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="">— Sem destino (abre home) —</option>
                {deepLinkOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label} ({d.value})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Data / hora (deixe em branco para enviar agora)</div>
              <Input name="scheduledAt" type="datetime-local" />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Alvo</div>
              <select name="targetScope" defaultValue="ROLES" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="ALL">Todos</option>
                <option value="ROLES">Por perfis / Roles</option>
                <option value="MINISTRIES">Por ministério</option>
                <option value="CELLS">Por célula</option>
                <option value="PEOPLE">Por pessoa</option>
              </select>
            </div>

            <div data-scope-field="ROLES" className="space-y-2">
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

            <div data-scope-field="MINISTRIES" className="space-y-2 hidden">
              <div className="text-xs font-medium text-muted-foreground">Ministérios</div>
              <select
                name="targetMinistries"
                multiple
                className="h-32 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div data-scope-field="CELLS" className="space-y-2 hidden">
              <div className="text-xs font-medium text-muted-foreground">Células</div>
              <select
                name="targetCells"
                multiple
                className="h-32 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {cells.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.leader ? ` — Líder: ${c.leader.fullName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div data-scope-field="PEOPLE" className="space-y-2 hidden">
              <div className="text-xs font-medium text-muted-foreground">Pessoas</div>
              <select
                name="targetPeople"
                multiple
                className="h-32 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.user?.id ?? ""} disabled={!p.user?.id}>
                    {p.fullName}
                    {p.email ? ` (${p.email})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Tipos de membro (extra, opcional)</div>
              <select
                name="targetMemberTypes"
                multiple
                className="h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {allMemberTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button className="w-full" type="submit">
                Enviar agora
              </Button>
              <Button className="w-full" type="submit" variant="secondary">
                Agendar / Salvar
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Para agendar, preencha o campo Data/hora acima. Se o campo ficar em branco, o envio será imediato.
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
