import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { assertWebPermission } from "@/server/access-control";
import { prisma } from "@/server/db";
import { closeRaffle } from "../../actions";
import { RaffleForm } from "../../RaffleForm";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function RaffleResultPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await assertWebPermission("raffles:read");
  const { id } = await params;
  const raffle = await prisma.raffle.findUnique({
    where: { id },
    include: { result: true, _count: { select: { tickets: { where: { paidAt: { not: null } } } } } },
  });
  if (!raffle) notFound();
  const result = raffle.result;
  const paid = raffle._count.tickets;
  const canRecord = Boolean(raffle.authorization && paid && session.permissions?.includes("raffles:write"));
  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <Link href={`/admin/sorteio/${id}`} className="text-sm text-primary">← Voltar aos participantes</Link>
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">{result ? "Relatório do sorteio" : "Apuração do sorteio"}</h1>
        <p className="text-sm text-muted-foreground">{raffle.title} · {raffle.prize}</p>
      </header>
      {result ? (
        <Card className="space-y-3 p-5">
          <p className="text-xl font-semibold">Nº {result.winningNumber} · {result.winnerName}</p>
          <p>Arrecadação confirmada: <strong>{currency.format(result.raisedCents / 100)}</strong></p>
          <p className="text-sm">{result.paidCount} números pagos de {result.reservedCount} reservados</p>
          <dl className="space-y-2 text-sm text-muted-foreground">
            <div><dt className="font-semibold">Certificado de autorização</dt><dd>{raffle.authorization}</dd></div>
            <div><dt className="font-semibold">Referência da apuração</dt><dd>{result.reference}</dd></div>
            <div><dt className="font-semibold">Registro do resultado</dt><dd>{dateTime.format(result.recordedAt)}</dd></div>
          </dl>
        </Card>
      ) : (
        <Card className="space-y-4 p-5">
          <p className="text-sm">{paid} números pagos · {currency.format(paid * raffle.priceCents / 100)} arrecadados.</p>
          {canRecord ? (
            <>
              <p className="text-sm text-muted-foreground">Apure conforme o regulamento autorizado. Registre o número contemplado e a referência da extração usada. Somente números pagos são aceitos.</p>
              <RaffleForm action={closeRaffle.bind(null, id)} label="Registrar resultado e encerrar">
                <label className="block space-y-1 text-sm"><span>Número contemplado</span><Input name="number" type="number" min={raffle.firstNumber} max={raffle.lastNumber} required /></label>
                <label className="block space-y-1 text-sm"><span>Referência da apuração</span><Input name="reference" placeholder="Ex.: número e data da extração" required maxLength={240} /></label>
                <label className="flex items-start gap-2 text-sm"><input name="confirmed" type="checkbox" required />Confirmo o resultado e o encerramento das reservas e dos pagamentos.</label>
              </RaffleForm>
            </>
          ) : <p className="text-sm text-muted-foreground">{!raffle.authorization ? "Abra o sorteio com o certificado de autorização." : !paid ? "Confirme pelo menos um pagamento para registrar o resultado." : "Aguardando o registro pelo operador."}</p>}
        </Card>
      )}
    </main>
  );
}
