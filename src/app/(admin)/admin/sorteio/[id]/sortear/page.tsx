import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { assertWebPermission } from "@/server/access-control";
import { prisma } from "@/server/db";
import { DrawSimulation } from "./DrawSimulation";

export default async function DrawPage({ params }: { params: Promise<{ id: string }> }) {
  await assertWebPermission("raffles:write");
  const { id } = await params;
  const raffle = await prisma.raffle.findUnique({
    where: { id },
    select: { title: true, prize: true, firstNumber: true, lastNumber: true, result: { select: { raffleId: true } } },
  });
  if (!raffle || raffle.result) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <Link href={`/admin/sorteio/${id}`} className="text-sm text-primary">← Voltar ao sorteio</Link>
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Sortear número</h1>
        <p className="text-sm text-muted-foreground">{raffle.title} · {raffle.prize}</p>
      </header>
      <Card className="space-y-5 p-6 text-center">
        <div className="space-y-2">
          <h2 className="font-semibold">Simulação de sorteio</h2>
          <p className="text-sm text-muted-foreground">
            Faixa de {raffle.firstNumber} a {raffle.lastNumber}. Apenas números pagos participam da simulação.
          </p>
        </div>
        <DrawSimulation raffleId={id} />
        <p className="text-sm text-muted-foreground">
          A simulação não grava um ganhador. Registre o resultado oficial conforme o regulamento autorizado.
        </p>
        <Link href={`/admin/sorteio/${id}/apuracao`} className="text-sm font-semibold text-primary">Ir para a apuração oficial</Link>
      </Card>
    </main>
  );
}
