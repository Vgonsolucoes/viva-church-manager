import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { endOfMonth, startOfMonth } from "date-fns";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const year = toInt(url.searchParams.get("year"), now.getFullYear());
  const month = toInt(url.searchParams.get("month"), now.getMonth() + 1);

  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(from);

  const txs = await prisma.financeTransaction.findMany({
    where: { occurredAt: { gte: from, lte: to } },
    orderBy: { occurredAt: "asc" },
    include: { ministry: true, project: true },
    take: 5000,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Financeiro ${month}/${year}`);

  ws.columns = [
    { header: "Data", key: "date", width: 12 },
    { header: "Direção", key: "direction", width: 10 },
    { header: "Tipo", key: "kind", width: 12 },
    { header: "Valor (centavos)", key: "amountCents", width: 18 },
    { header: "Categoria", key: "category", width: 18 },
    { header: "Centro de custo", key: "costCenter", width: 18 },
    { header: "Ministério", key: "ministry", width: 18 },
    { header: "Projeto", key: "project", width: 18 },
    { header: "Descrição", key: "description", width: 32 },
  ];

  txs.forEach((t) => {
    ws.addRow({
      date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(t.occurredAt),
      direction: t.direction,
      kind: t.kind,
      amountCents: t.amountCents,
      category: t.category ?? "",
      costCenter: t.costCenter ?? "",
      ministry: t.ministry?.name ?? "",
      project: t.project?.name ?? "",
      description: t.description ?? "",
    });
  });

  ws.getRow(1).font = { bold: true };

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="financeiro-${year}-${String(month).padStart(2, "0")}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}

