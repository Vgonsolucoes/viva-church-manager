import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { prisma } from "@/server/db";
import { selectedMonth, monthlySession } from "@/server/discipleship-monthly";
import { uploadMonthlyMaterial } from "./actions";
import { SubmitButton } from "@/app/(admin)/admin/cells/[id]/SubmitButton";

export async function MonthlyDiscipleshipMaterial({ month: input, groups = false }: { month?: string; groups?: boolean }) {
  const { context } = await monthlySession();
  if (!context) return null;
  const month = selectedMonth(input);
  const material = await prisma.discipleshipMaterial.findUnique({
    where: { rootMemberId_month: { rootMemberId: context.rootId, month } },
    select: { id: true, title: true, filename: true },
  });
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Material mensal de discipulado</h2>
        <form method="get" action={groups ? "/admin/discipleships/groups" : "/admin/discipleships"} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">Mês
            <Input type="month" name="month" defaultValue={month} required />
          </label>
          <Button type="submit" variant="secondary">Consultar</Button>
        </form>
      </div>
      {material ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div><p className="font-medium">{material.title}</p><p className="text-xs text-muted-foreground">{material.filename}</p></div>
          <a href={`/api/v1/discipleship/materials/${material.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline">Abrir PDF</a>
        </div>
      ) : <p className="text-sm text-muted-foreground">O material deste mês ainda não foi publicado para sua rede.</p>}
      {context.canUpload ? (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-medium">{material ? "Substituir PDF do mês" : "Publicar PDF do mês"}</summary>
          <form action={uploadMonthlyMaterial} className="grid gap-3">
            <input type="hidden" name="month" value={month} />
            <label className="grid gap-1 text-sm">Título do material
              <Input name="title" defaultValue={material?.title ?? ""} maxLength={160} required />
            </label>
            <label className="grid gap-1 text-sm">Arquivo PDF · até 8 MB
              <Input name="pdf" type="file" accept="application/pdf,.pdf" required />
            </label>
            <div><SubmitButton>{material ? "Substituir material" : "Publicar material"}</SubmitButton></div>
          </form>
        </details>
      ) : null}
      {!groups ? <Link href={`/admin/discipleships/groups?month=${month}`} className="inline-block text-sm font-medium underline">Encontro em Grupo</Link> : null}
    </Card>
  );
}
