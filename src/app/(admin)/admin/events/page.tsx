import { syncStaffingSchedule } from "@/server/staffing";
import { staffingUrl } from "@/lib/staffing";
import { hasPermission } from "@/server/rbac";
import { redirect } from "next/navigation";
import { assertWebPermission } from "@/server/access-control";
import Image from "next/image";
import Link from "next/link";
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
import { savePublicImageUpload } from "@/server/uploads";

export const dynamic = "force-dynamic";

const createEventSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["SERVICE", "CONFERENCE", "CELL", "TRAINING", "SOCIAL_ACTION", "EXTERNAL"]).default("SERVICE"),
  startsAt: z.string().min(5),
  endsAt: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  bannerImageUrl: z.string().url().optional().or(z.literal("")),
  capacity: z.string().optional().or(z.literal("")),
  isPaid: z.string().optional(),
  ticketPrice: z.string().optional().or(z.literal("")),
  allowPix: z.string().optional(),
  allowCreditCard: z.string().optional(),
  public: z.string().optional(),
});

const createSaleSchema = z.object({
  eventId: z.string().min(1),
  buyerName: z.string().min(2),
  buyerEmail: z.string().email().optional().or(z.literal("")),
  buyerPhone: z.string().optional().or(z.literal("")),
  quantity: z.string().min(1),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD"]),
});

function parseMoneyToCents(raw: string) {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseOptionalPositiveInt(raw: string | undefined) {
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

async function createEvent(formData: FormData) {
  "use server";
  await saveEvent(null, formData);
}

async function saveEvent(eventId: string | null, formData: FormData) {
  "use server";
  await assertWebPermission("events:write");

  const session = await getServerSession(authOptions);
  const before = eventId ? await prisma.event.findUnique({ where: { id: eventId } }) : null;
  if (eventId && (!before || eventId.startsWith("viva-weekly-"))) return;
  const parsed = createEventSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location"),
    bannerImageUrl: formData.get("bannerImageUrl"),
    capacity: formData.get("capacity"),
    isPaid: formData.get("isPaid") ?? undefined,
    ticketPrice: formData.get("ticketPrice"),
    allowPix: formData.get("allowPix") ?? undefined,
    allowCreditCard: formData.get("allowCreditCard") ?? undefined,
    public: formData.get("public") ?? undefined,
  });
  if (!parsed.success) return;

  const bannerFile = formData.get("bannerFile");
  const uploadedBannerUrl = bannerFile instanceof File && bannerFile.size
    ? await savePublicImageUpload(bannerFile) : null;
  if (bannerFile instanceof File && bannerFile.size && !uploadedBannerUrl) return;
  const bannerImageUrl = uploadedBannerUrl ?? (parsed.data.bannerImageUrl || before?.bannerImageUrl || null);

  const capacity = parseOptionalPositiveInt(parsed.data.capacity);
  const isPaid = parsed.data.isPaid === "on";
  const ticketPriceCents = parsed.data.ticketPrice
    ? parseMoneyToCents(parsed.data.ticketPrice)
    : null;
  const allowPix = isPaid && parsed.data.allowPix === "on";
  const allowCreditCard = isPaid && parsed.data.allowCreditCard === "on";

  if (parsed.data.capacity && capacity === null) return;
  if (isPaid && (!ticketPriceCents || ticketPriceCents <= 0)) return;
  if (isPaid && !allowPix && !allowCreditCard) return;

  const startsAt = new Date(`${parsed.data.startsAt}-03:00`);
  const endsAt = parsed.data.endsAt ? new Date(`${parsed.data.endsAt}-03:00`) : null;
  if (Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < startsAt))) return;
  const data = {
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      startsAt,
      endsAt,
      location: parsed.data.location ? parsed.data.location.trim() : null,
      bannerImageUrl,
      capacity,
      isPaid,
      ticketPriceCents: isPaid ? ticketPriceCents : null,
      allowPix,
      allowCreditCard,
      public: parsed.data.public === "on",
  };
  const event = eventId
    ? await prisma.event.update({ where: { id: eventId }, data })
    : await prisma.event.create({ data: {
      ...data,
      schedules: { create: {
        title: data.name, kind: data.type === "SERVICE" ? "SERVICE" : "EVENT", startsAt, endsAt,
      } },
    } });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: eventId ? "UPDATE" : "CREATE",
    entityType: "Event",
    entityId: event.id,
    after: {
      id: event.id,
      name: event.name,
      type: event.type,
      startsAt: event.startsAt,
      public: event.public,
      capacity: event.capacity,
      isPaid: event.isPaid,
      ticketPriceCents: event.ticketPriceCents,
      allowPix: event.allowPix,
      allowCreditCard: event.allowCreditCard,
      bannerImageUrl: event.bannerImageUrl,
    },
  });

  const staffingId = await syncStaffingSchedule(event);
  revalidatePath("/admin/events");
  revalidatePath("/admin/schedules");
  if (staffingId && hasPermission(session?.permissions ?? [], "schedules:read")) redirect(staffingUrl(staffingId, event.startsAt));
  redirect("/admin/events?salvo=1");
}

async function deleteEvent(eventId: string) {
  "use server";
  const session = await assertWebPermission("events:write");
  if (eventId.startsWith("viva-weekly-")) return;
  const removed = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) return null;
    await tx.schedule.deleteMany({ where: { eventId } });
    await tx.event.delete({ where: { id: eventId } });
    return event;
  });
  if (removed) await logAudit({ actorUserId: session.uid, action: "DELETE", entityType: "Event", entityId: eventId, before: { id: eventId, name: removed.name } });
  revalidatePath("/admin/events");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/finance");
  redirect("/admin/events?excluido=1");
}

async function createSale(formData: FormData) {
  "use server";
  await assertWebPermission("events:write");

  const session = await getServerSession(authOptions);
  const parsed = createSaleSchema.safeParse({
    eventId: formData.get("eventId"),
    buyerName: formData.get("buyerName"),
    buyerEmail: formData.get("buyerEmail"),
    buyerPhone: formData.get("buyerPhone"),
    quantity: formData.get("quantity"),
    paymentMethod: formData.get("paymentMethod"),
  });
  if (!parsed.success) return;

  const quantity = Number.parseInt(parsed.data.quantity, 10);
  if (!Number.isInteger(quantity) || quantity <= 0) return;

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      isPaid: true,
      ticketPriceCents: true,
      capacity: true,
      allowPix: true,
      allowCreditCard: true,
    },
  });
  if (!event || !event.isPaid || !event.ticketPriceCents) return;
  const unitPriceCents = event.ticketPriceCents;

  if (parsed.data.paymentMethod === "PIX" && !event.allowPix) return;
  if (parsed.data.paymentMethod === "CREDIT_CARD" && !event.allowCreditCard) return;

  const salesAgg = await prisma.eventSale.aggregate({
    where: { eventId: event.id },
    _sum: { quantity: true },
  });
  const soldTickets = salesAgg._sum.quantity ?? 0;
  if (event.capacity !== null && soldTickets + quantity > event.capacity) return;

  const amountCents = unitPriceCents * quantity;

  const result = await prisma.$transaction(async (tx) => {
    const financeTransaction = await tx.financeTransaction.create({
      data: {
        direction: "IN",
        kind: "OTHER",
        category: event.name,
        costCenter: "Eventos",
        eventId: event.id,
        paymentMethod: parsed.data.paymentMethod,
        amountCents,
        description: `Venda de ingresso - ${event.name} - ${parsed.data.buyerName.trim()}`,
        occurredAt: new Date(),
        createdById: session?.uid ?? null,
      },
    });

    const sale = await tx.eventSale.create({
      data: {
        eventId: event.id,
        buyerName: parsed.data.buyerName.trim(),
        buyerEmail: parsed.data.buyerEmail ? parsed.data.buyerEmail.trim().toLowerCase() : null,
        buyerPhone: parsed.data.buyerPhone ? parsed.data.buyerPhone.trim() : null,
        quantity,
        unitPriceCents,
        amountCents,
        paymentMethod: parsed.data.paymentMethod,
        financeTransactionId: financeTransaction.id,
        createdById: session?.uid ?? null,
      },
    });

    return { financeTransaction, sale };
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "EventSale",
    entityId: result.sale.id,
    after: {
      id: result.sale.id,
      eventId: event.id,
      eventName: event.name,
      quantity,
      amountCents,
      paymentMethod: parsed.data.paymentMethod,
    },
  });

  revalidatePath("/admin/events");
  revalidatePath("/admin/finance");
}

export default async function EventsPage({ searchParams }: {
  searchParams: Promise<{ edit?: string; salvo?: string; excluido?: string }>;
}) {
  const [query, session] = await Promise.all([searchParams, getServerSession(authOptions)]);
  const canEdit = hasPermission(session?.permissions ?? [], "events:write");
  const editing = canEdit && query.edit && !query.edit.startsWith("viva-weekly-")
    ? await prisma.event.findUnique({ where: { id: query.edit } }) : null;
  const localDateTime = (date?: Date | null) => date
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(" ", "T")
    : "";
  const [events, recentSales] = await Promise.all([
    prisma.event.findMany({
      where: { NOT: { id: { startsWith: "viva-weekly-" } } },
      orderBy: { startsAt: "desc" },
      take: 50,
      include: {
        schedules: { select: { id: true }, take: 1 },
        sales: {
          select: {
            id: true,
            buyerName: true,
            quantity: true,
            amountCents: true,
            paymentMethod: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.eventSale.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        event: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const paidEvents = events.filter((event) => event.isPaid);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Eventos</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Eventos internos e externos, com vagas, ingressos e recebimentos integrados ao financeiro.
        </div>
      </div>
      {query.salvo === "1" ? <p role="status">Evento salvo com sucesso.</p> : null}
      {query.excluido === "1" ? <p role="status">Evento e escalas vinculadas excluídos.</p> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Lista de eventos</div>
              <div className="text-xs text-muted-foreground">{events.length} exibidos</div>
            </div>
            <div className="mt-4 divide-y divide-border">
              {events.length ? (
                events.map((event) => {
                  const soldTickets = event.sales.reduce((sum, sale) => sum + sale.quantity, 0);
                  const revenueCents = event.sales.reduce((sum, sale) => sum + sale.amountCents, 0);
                  const remainingTickets =
                    event.capacity !== null ? Math.max(event.capacity - soldTickets, 0) : null;

                  return (
                    <div key={event.id} className="py-4">
                      {event.bannerImageUrl ? (
                        <div className="mb-4 overflow-hidden rounded-3xl border border-border/70 bg-muted/10">
                          <div className="relative aspect-[3/1] w-full">
                            <Image
                              src={event.bannerImageUrl}
                              alt={event.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 1280px) 100vw, 800px"
                              unoptimized
                            />
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{event.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(event.startsAt)}
                            {event.endsAt
                              ? ` até ${new Intl.DateTimeFormat("pt-BR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                }).format(event.endsAt)}`
                              : ""}
                            {event.location ? ` • ${event.location}` : ""} • {event.type}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {event.public ? <Badge>PUBLICO</Badge> : <Badge className="opacity-60">PRIVADO</Badge>}
                            {event.isPaid ? <Badge>PAGO</Badge> : <Badge className="opacity-70">GRATUITO</Badge>}
                            {event.capacity !== null ? (
                              <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">VAGAS {event.capacity}</Badge>
                            ) : (
                              <Badge className="opacity-60">SEM LIMITE</Badge>
                            )}
                            {event.isPaid && event.allowPix ? (
                              <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">PIX</Badge>
                            ) : null}
                            {event.isPaid && event.allowCreditCard ? (
                              <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">CARTAO</Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{event.isPaid && event.ticketPriceCents ? formatMoney(event.ticketPriceCents) : "Entrada livre"}</div>
                          <div className="mt-1">Ingressos vendidos: {soldTickets}</div>
                          <div className="mt-1">
                            {remainingTickets !== null ? `Vagas restantes: ${remainingTickets}` : "Vagas ilimitadas"}
                          </div>
                          <div className="mt-1">Financeiro: {formatMoney(revenueCents)}</div>
                        </div>
                      </div>
                      {canEdit ? (
                        <div className="mt-3 flex flex-wrap items-start gap-4">
                          <Link href={`/admin/events?edit=${event.id}#event-form`} className="text-sm font-medium underline">Editar evento</Link>
                          <Link href={staffingUrl(event.schedules[0]?.id ?? `staffing-event-${event.id}`, event.startsAt)} className="text-sm font-medium underline">Montar escala</Link>
                          <details className="text-sm">
                            <summary className="cursor-pointer text-destructive">Excluir evento</summary>
                            <div className="mt-2 space-y-2">
                              <p className="max-w-md text-xs text-muted-foreground">A exclusão remove o evento, suas escalas e os registros de ingressos. Os lançamentos financeiros são mantidos.</p>
                              <form action={deleteEvent.bind(null, event.id)}>
                                <Button type="submit" variant="destructive" size="sm">Confirmar exclusão</Button>
                              </form>
                            </div>
                          </details>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-sm text-muted-foreground">
                  Nenhum evento cadastrado ainda.
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Vendas recentes</div>
              <div className="text-xs text-muted-foreground">{recentSales.length} exibidas</div>
            </div>
            <div className="mt-4 divide-y divide-border">
              {recentSales.length ? (
                recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{sale.event.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {sale.buyerName}
                        {sale.buyerEmail ? ` • ${sale.buyerEmail}` : ""}
                        {sale.buyerPhone ? ` • ${sale.buyerPhone}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(sale.createdAt)}{" "}
                        • {sale.quantity} ingresso(s) • {sale.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatMoney(sale.amountCents)}</div>
                      <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">{sale.paymentMethod}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-sm text-muted-foreground">
                  Nenhuma venda registrada ainda.
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div id="event-form" className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{editing ? "Editar evento" : "Novo evento"}</div>
              {editing ? <Link href="/admin/events" className="text-sm underline">Cancelar</Link> : null}
            </div>
            <form key={editing?.id ?? "new"} action={editing ? saveEvent.bind(null, editing.id) : createEvent} className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Nome</div>
                <Input name="name" defaultValue={editing?.name} placeholder="Ex: Conferência Viva" required />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Tipo</div>
                <select
                  name="type"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  defaultValue={editing?.type ?? "SERVICE"}
                >
                  <option value="SERVICE">Culto</option>
                  <option value="CONFERENCE">Conferência</option>
                  <option value="CELL">Célula</option>
                  <option value="TRAINING">Treinamento</option>
                  <option value="SOCIAL_ACTION">Ação social</option>
                  <option value="EXTERNAL">Externo</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Início</div>
                  <Input name="startsAt" type="datetime-local" defaultValue={localDateTime(editing?.startsAt)} required />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Fim</div>
                  <Input name="endsAt" type="datetime-local" defaultValue={localDateTime(editing?.endsAt)} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Local</div>
                <Input name="location" defaultValue={editing?.location ?? ""} placeholder="Ex: Sede" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Banner (horizontal)</div>
                <input
                  type="file"
                  name="bannerFile"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-muted/30 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground hover:file:bg-muted/40"
                />
                <Input name="bannerImageUrl" defaultValue={editing?.bannerImageUrl?.startsWith("http") ? editing.bannerImageUrl : ""} placeholder="Ou cole uma URL de imagem (opcional)" />
                {editing?.bannerImageUrl ? <p className="text-xs text-muted-foreground">Envie uma nova imagem para substituir a arte atual.</p> : null}
                <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                  <div className="text-xs text-muted-foreground">
                    Recomendado: banner horizontal (ex: 1200×400 ou 3:1).
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Quantidade de vagas</div>
                <Input name="capacity" type="number" min="1" defaultValue={editing?.capacity ?? ""} placeholder="Ex: 300" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isPaid" className="size-4" defaultChecked={editing?.isPaid ?? false} />
                <span>Evento pago</span>
              </label>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Valor do ingresso (R$)</div>
                <Input name="ticketPrice" defaultValue={editing?.ticketPriceCents ? (editing.ticketPriceCents / 100).toFixed(2).replace(".", ",") : ""} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Recebimento</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="allowPix" className="size-4" defaultChecked={editing?.allowPix ?? false} />
                  <span>PIX</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="allowCreditCard" className="size-4" defaultChecked={editing?.allowCreditCard ?? false} />
                  <span>Cartão de crédito</span>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="public" className="size-4" defaultChecked={editing?.public ?? false} />
                <span>Publicar no site (API pública)</span>
              </label>
              <Button className="w-full" type="submit">
                {editing ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-medium">Registrar venda</div>
            {paidEvents.length ? (
              <form action={createSale} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Evento pago</div>
                  <select
                    name="eventId"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    defaultValue={paidEvents[0]?.id}
                  >
                    {paidEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                        {event.ticketPriceCents ? ` • ${formatMoney(event.ticketPriceCents)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Comprador</div>
                  <Input name="buyerName" placeholder="Nome do comprador" required />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">E-mail</div>
                  <Input name="buyerEmail" type="email" placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Telefone</div>
                  <Input name="buyerPhone" placeholder="(00) 00000-0000" />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Quantidade</div>
                    <Input name="quantity" type="number" min="1" defaultValue="1" required />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Pagamento</div>
                    <select
                      name="paymentMethod"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      defaultValue="PIX"
                    >
                      <option value="PIX">PIX</option>
                      <option value="CREDIT_CARD">Cartão de crédito</option>
                    </select>
                  </div>
                </div>
                <Button className="w-full" type="submit">
                  Registrar venda
                </Button>
              </form>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">
                Cadastre pelo menos um evento pago para registrar vendas e lançar entradas no financeiro.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
