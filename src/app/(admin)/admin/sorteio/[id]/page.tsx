import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { assertWebPermission } from "@/server/access-control";
import { prisma } from "@/server/db";
import { openRaffle, reserveNumber, setPayment } from "../actions";
import { ParticipantFields, RaffleForm } from "../RaffleForm";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RafflePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await assertWebPermission("raffles:read");
  const { id } = await params;
  const raffle = await prisma.raffle.findUnique({ where: { id }, include: { result: true, tickets: { orderBy: { number: "asc" } } } });
  if (!raffle) notFound();
  const canWrite = session.permissions?.includes("raffles:write");
  const open = Boolean(raffle.authorization) && !raffle.result;
  const paid = raffle.tickets.filter((ticket) => ticket.paidAt).length;
  const availableCount = raffle.lastNumber - raffle.firstNumber + 1 - raffle.tickets.length;
  const available: number[] = [];
  const reserved = new Set(raffle.tickets.map((ticket) => ticket.number));
  for (let number = raffle.firstNumber; number <= raffle.lastNumber && available.length < 50; number++) {
    if (!reserved.has(number)) available.push(number);
  }
  const members = canWrite && open && availableCount > 0
    ? await prisma.member.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } })
    : [];
  return (
    <main className="space-y-5">
      <Link href="/admin/sorteio" className="text-sm text-primary">← Voltar aos sorteios</Link>
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">{raffle.title}</h1>
        <p className="text-sm text-muted-foreground">Prêmio: {raffle.prize} · Números {raffle.firstNumber} a {raffle.lastNumber} · {currency.format(raffle.priceCents / 100)} por número</p>
        {raffle.authorization && <p className="text-sm text-muted-foreground">Certificado: {raffle.authorization}</p>}
      </header>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{availableCount} disponíveis</Badge><Badge>{paid} pagos</Badge><Badge>{raffle.tickets.length - paid} pendentes</Badge>
          <Badge>Arrecadado: {currency.format((raffle.result?.raisedCents ?? paid * raffle.priceCents) / 100)}</Badge>
        </div>
        {(open || raffle.result) && <Link className="text-sm font-semibold text-primary" href={`/admin/sorteio/${id}/apuracao`}>{raffle.result ? "Ver relatório" : "Abrir tela de apuração"}</Link>}
      </Card>
      {canWrite && !raffle.authorization && (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Abrir sorteio</h2>
          <p className="text-sm text-muted-foreground">Registre o certificado de autorização antes de reservar números.</p>
          <RaffleForm action={openRaffle.bind(null, id)} label="Abrir reservas">
            <label className="block space-y-1 text-sm"><span>Certificado de autorização</span><Input name="authorization" required maxLength={120} /></label>
          </RaffleForm>
        </Card>
      )}
      {canWrite && open && availableCount > 0 && (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Reservar número</h2>
          <RaffleForm action={reserveNumber.bind(null, id)} label="Reservar número">
            <ParticipantFields members={members} />
            <label className="block space-y-1 text-sm">
              <span>Número escolhido</span>
              <Input name="number" type="number" min={raffle.firstNumber} max={raffle.lastNumber} list="available-raffle-numbers" required />
            </label>
            <datalist id="available-raffle-numbers">{available.map((number) => <option key={number} value={number} />)}</datalist>
            <p className="text-xs text-muted-foreground">Disponíveis: {available.join(", ")}{availableCount > available.length ? "…" : ""}</p>
          </RaffleForm>
        </Card>
      )}
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Participantes</h2>
        {raffle.tickets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum número reservado.</p>}
        {raffle.tickets.map((ticket) => (
          <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div><p className="font-medium">Nº {ticket.number} · {ticket.participantName}</p><Badge>{ticket.paidAt ? "Pago" : "Pagamento pendente"}</Badge></div>
            {canWrite && open && <RaffleForm action={setPayment.bind(null, id, ticket.id, !ticket.paidAt)} label={ticket.paidAt ? "Voltar para pendente" : "Marcar como pago"} />}
          </div>
        ))}
      </Card>
    </main>
  );
}
