import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const q = `?year=${year}&month=${month}`;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Relatórios</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Exportação em PDF/Excel para financeiro, membros e voluntários.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="text-sm font-medium">Financeiro</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Padrão: mês atual <Badge>{String(month).padStart(2, "0")}/{year}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <a
              className="rounded-2xl border border-border bg-muted/20 p-4 text-sm font-medium hover:bg-muted/30"
              href={`/api/reports/finance/monthly.pdf${q}`}
              target="_blank"
              rel="noreferrer"
            >
              Exportar Financeiro (PDF)
              <div className="mt-1 text-xs text-muted-foreground">
                Entradas/saídas, saldo e lista de movimentações.
              </div>
            </a>
            <a
              className="rounded-2xl border border-border bg-muted/20 p-4 text-sm font-medium hover:bg-muted/30"
              href={`/api/reports/finance/monthly.xlsx${q}`}
              target="_blank"
              rel="noreferrer"
            >
              Exportar Financeiro (Excel)
              <div className="mt-1 text-xs text-muted-foreground">
                Planilha com transações do mês.
              </div>
            </a>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Cadastros</div>
          <div className="mt-4 space-y-3">
            <a
              className="block rounded-2xl border border-border bg-muted/20 p-4 text-sm font-medium hover:bg-muted/30"
              href="/api/reports/members.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              Exportar Membros (Excel)
              <div className="mt-1 text-xs text-muted-foreground">
                Lista de membros com contatos e tipo.
              </div>
            </a>
            <a
              className="block rounded-2xl border border-border bg-muted/20 p-4 text-sm font-medium hover:bg-muted/30"
              href="/api/reports/volunteers.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              Exportar Voluntários (Excel)
              <div className="mt-1 text-xs text-muted-foreground">
                Lista de voluntários, ministério e disponibilidade.
              </div>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

