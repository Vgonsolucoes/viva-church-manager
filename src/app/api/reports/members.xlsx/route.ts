import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.member.findMany({
    orderBy: { fullName: "asc" },
    take: 10000,
    include: { ministry: true, memberMinistries: { include: { ministry: true } } },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Membros");

  ws.columns = [
    { header: "Nome", key: "fullName", width: 28 },
    { header: "CPF", key: "cpf", width: 18 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Telefone", key: "phone", width: 18 },
    { header: "Tipos", key: "types", width: 26 },
    { header: "Ministério", key: "ministry", width: 18 },
    { header: "Batizado", key: "baptized", width: 10 },
    { header: "Célula", key: "cell", width: 10 },
  ];

  rows.forEach((m) => {
    ws.addRow({
      fullName: m.fullName,
      cpf: m.cpf ?? "",
      email: m.email ?? "",
      phone: m.phone ?? "",
      types: (m.types.length ? m.types : [m.type]).join(", "),
      ministry: m.memberMinistries.length
        ? m.memberMinistries.map((mm) => mm.ministry.name).join(", ")
        : (m.ministry?.name ?? ""),
      baptized: m.baptized ? "Sim" : "Não",
      cell: m.participatesInCell ? "Sim" : "Não",
    });
  });

  ws.getRow(1).font = { bold: true };

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="membros.xlsx"',
      "cache-control": "no-store",
    },
  });
}
