import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return new NextResponse("Not Found", { status: 404 });

  const payload = asset.qrCode ?? `asset:${asset.code}`;
  const png = await QRCode.toBuffer(payload, {
    type: "png",
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
    },
  });
}
