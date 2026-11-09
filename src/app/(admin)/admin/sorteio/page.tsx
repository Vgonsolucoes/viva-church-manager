import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { assertWebPermission } from "@/server/access-control";
import { prisma } from "@/server/db";
import { createRaffle } from "./actions";
import { RaffleForm } from "./RaffleForm";

export default async function RafflesPage() {
  const session = await assertWebPermission("raffles:read");
  const raffles = await prisma.raffle.findMany({ orderBy: { createdAt: "desc" }, include: { result: true, _count: { select: { tickets: true } } } });
  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Sorteio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cadastre prêmios, reserve números, confirme pagamentos e consulte os resultados.</p>
      </header>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {raffles.map((raffle) => (
            <Card key={raffle.id} className="space-y-2 p-4">
              <Badge>{raffle.result ? "Encerrado" : raffle.authorization ? "Aberto" : "Rascunho"}</Badge>
              <h2 className="font-semibold"><Link className="hover:underline" href={`/admin/sorteio/${raffle.id}`}>{raffle.title}</Link></h2>
              <p className="text-sm text-muted-foreground">{raffle.prize} · {raffle._count.tickets} números reservados</p>
              {raffle.result && <Link className="text-sm font-semibold text-primary" href={`/admin/sorteio/${raffle.id}/apuracao`}>Ver relatório</Link>}
            </Card>
          ))}
          {!raffles.length && <Card className="p-4 text-sm text-muted-foreground">Nenhum sorteio cadastrado.</Card>}
        </div>
        {session.permissions?.includes("raffles:write") && (
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Novo sorteio</h2>
            <RaffleForm action={createRaffle} label="Criar rascunho">
              <label className="block space-y-1 text-sm"><span>Título</span><Input name="title" required maxLength={120} /></label>
              <label className="block space-y-1 text-sm"><span>Prêmio</span><Input name="prize" required maxLength={240} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm"><span>Primeiro número</span><Input name="firstNumber" type="number" min={0} max={99999} defaultValue={1} required /></label>
                <label className="space-y-1 text-sm"><span>Último número</span><Input name="lastNumber" type="number" min={0} max={99999} required /></label>
              </div>
              <label className="block space-y-1 text-sm"><span>Valor por número (R$)</span><Input name="price" inputMode="decimal" placeholder="10,00" required maxLength={8} /></label>
            </RaffleForm>
          </Card>
        )}
      </div>
    </main>
  );
}
