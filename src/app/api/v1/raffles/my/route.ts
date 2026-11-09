import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";

export async function GET(request: Request) {
  const auth = await requireLoggedIn(request);
  if (!auth.ok) return auth.error;
  if (!auth.ctx.access.mobileModules.includes("raffles")) {
    return Response.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  const memberId = auth.ctx.member?.id;
  const tickets = memberId ? await prisma.raffleTicket.findMany({
    where: { memberId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, number: true, paidAt: true,
      raffle: { select: { title: true, prize: true, priceCents: true, result: { select: { winningNumber: true } } } },
    },
  }) : [];
  return Response.json(tickets.map(({ id, number, paidAt, raffle }) => ({
    id, number, paid: paidAt !== null,
    title: raffle.title, prize: raffle.prize, priceCents: raffle.priceCents,
    closed: raffle.result !== null, won: raffle.result?.winningNumber === number,
  })), { headers: { "Cache-Control": "private, no-store" } });
}
