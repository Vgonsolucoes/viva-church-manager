import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const readSchema = z.object({ id: z.string().min(1) });

async function markRead(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session?.uid) return;

  const parsed = readSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  await prisma.notificationDelivery.updateMany({
    where: { id: parsed.data.id, userId: session.uid },
    data: { readAt: new Date() },
  });

  revalidatePath("/app/notifications");
}

export default async function MobileNotificationsPage() {
  const session = await getServerSession(authOptions);
  const deliveries = session?.uid
    ? await prisma.notificationDelivery.findMany({
        where: { userId: session.uid },
        orderBy: { deliveredAt: "desc" },
        take: 30,
        include: { notification: true },
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">Notificações</div>
        <div className="text-sm text-muted-foreground">
          Avisos e comunicados da igreja.
        </div>
      </div>

      <div className="space-y-3">
        {deliveries.length ? (
          deliveries.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{d.notification.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(d.deliveredAt)}
                  </div>
                </div>
                {d.readAt ? <Badge>Lido</Badge> : <Badge className="opacity-70">Novo</Badge>}
              </div>
              <div className="mt-3 text-sm text-muted-foreground">{d.notification.body}</div>
              {!d.readAt ? (
                <form action={markRead} className="mt-4">
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    Marcar como lida
                  </Button>
                </form>
              ) : null}
            </Card>
          ))
        ) : (
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">
              Nenhuma notificação no momento.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
