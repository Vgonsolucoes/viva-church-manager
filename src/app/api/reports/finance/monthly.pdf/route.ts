import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { endOfMonth, startOfMonth } from "date-fns";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function renderPdf(params: { year: number; month: number }) {
  const from = startOfMonth(new Date(params.year, params.month - 1, 1));
  const to = endOfMonth(from);

  const [txs, sumIn, sumOut] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { occurredAt: { gte: from, lte: to } },
      orderBy: { occurredAt: "asc" },
      include: { ministry: true, project: true },
      take: 5000,
    }),
    prisma.financeTransaction.aggregate({
      _sum: { amountCents: true },
      where: { direction: "IN", occurredAt: { gte: from, lte: to } },
    }),
    prisma.financeTransaction.aggregate({
      _sum: { amountCents: true },
      where: { direction: "OUT", occurredAt: { gte: from, lte: to } },
    }),
  ]);

  const inCents = sumIn._sum.amountCents ?? 0;
  const outCents = sumOut._sum.amountCents ?? 0;
  const balance = inCents - outCents;

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];

  doc.on("data", (d) => chunks.push(Buffer.from(d)));

  doc.fontSize(18).text("Viva Church Manager", { continued: false });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor("#444").text(`Relatório Financeiro • ${String(params.month).padStart(2, "0")}/${params.year}`);
  doc.moveDown(1);

  doc.fillColor("#111").fontSize(12);
  doc.text(`Entradas: ${brl(inCents)}`);
  doc.text(`Saídas: ${brl(outCents)}`);
  doc.text(`Saldo: ${brl(balance)}`);
  doc.moveDown(1);

  doc.fontSize(11).fillColor("#111").text("Movimentações", { underline: true });
  doc.moveDown(0.5);

  txs.forEach((t) => {
    const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(t.occurredAt);
    const line = [
      date,
      t.direction,
      t.kind,
      brl(t.amountCents),
      t.ministry?.name ? `Min: ${t.ministry.name}` : null,
      t.project?.name ? `Proj: ${t.project.name}` : null,
      t.category ? `Cat: ${t.category}` : null,
      t.description ? `Desc: ${t.description}` : null,
    ]
      .filter(Boolean)
      .join(" • ");
    doc.fontSize(9).fillColor("#111").text(line);
  });

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", () => resolve()));
  return Buffer.concat(chunks);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const year = toInt(url.searchParams.get("year"), now.getFullYear());
  const month = toInt(url.searchParams.get("month"), now.getMonth() + 1);

  const pdf = await renderPdf({ year, month });
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="financeiro-${year}-${String(month).padStart(2, "0")}.pdf"`,
      "cache-control": "no-store",
    },
  });
}

