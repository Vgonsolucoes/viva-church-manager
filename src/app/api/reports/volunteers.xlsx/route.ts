import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.volunteerProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 10000,
    include: { member: true, ministry: true },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Voluntários");

  ws.columns = [
    { header: "Nome", key: "name", width: 28 },
    { header: "Telefone", key: "phone", width: 18 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Ministério", key: "ministry", width: 18 },
    { header: "Disponibilidade", key: "availability", width: 22 },
    { header: "Habilidades", key: "skills", width: 32 },
    { header: "Restrições", key: "restrictions", width: 22 },
    { header: "Faltas", key: "absences", width: 10 },
  ];

  rows.forEach((v) => {
    ws.addRow({
      name: v.member.fullName,
      phone: v.member.phone ?? "",
      email: v.member.email ?? "",
      ministry: v.ministry?.name ?? "",
      availability: v.availability ?? "",
      skills: v.skills.join(", "),
      restrictions: v.restrictions ?? "",
      absences: v.absencesCount,
    });
  });

  ws.getRow(1).font = { bold: true };

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="voluntarios.xlsx"',
      "cache-control": "no-store",
    },
  });
}

