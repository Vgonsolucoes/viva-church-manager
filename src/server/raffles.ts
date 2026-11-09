import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export class RaffleError extends Error {}

// Each operation takes the same lock so payment, reservations and closing
// cannot change the set of paid tickets while a result is being recorded.
export async function withOpenRaffle<T>(
  id: string,
  operation: (tx: Prisma.TransactionClient, raffle: { id: string; title: string; firstNumber: number; lastNumber: number; priceCents: number }) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Raffle" WHERE id = ${id} FOR UPDATE`;
    const raffle = await tx.raffle.findUnique({ where: { id }, include: { result: true } });
    if (!raffle || raffle.result) throw new RaffleError("Este sorteio não está disponível para alterações.");
    if (!raffle.authorization) throw new RaffleError("Informe o certificado de autorização para abrir o sorteio.");
    return operation(tx, raffle);
  });
}

export async function reserveRaffleTicket(raffleId: string, number: number, memberId: string, name: string, actorId: string) {
  return withOpenRaffle(raffleId, async (tx, raffle) => {
    if (number < raffle.firstNumber || number > raffle.lastNumber) throw new RaffleError("Escolha um número da faixa cadastrada.");
    const key = { raffleId, number };
    if (await tx.raffleTicket.findUnique({ where: { raffleId_number: key }, select: { id: true } })) {
      throw new RaffleError("Este número já está reservado. Escolha outro.");
    }
    const member = memberId ? await tx.member.findUnique({
      where: { id: memberId },
      select: { id: true, fullName: true, user: { select: { id: true } } },
    }) : null;
    if (memberId && !member) throw new RaffleError("Selecione um membro cadastrado.");
    const participantName = member?.fullName ?? name;
    if (!participantName) throw new RaffleError("Selecione um membro ou informe o nome do participante.");
    const ticket = await tx.raffleTicket.create({
      data: { ...key, memberId: member?.id, participantName },
    });
    if (member?.user) {
      await tx.notification.create({
        data: {
          title: "Número reservado no sorteio",
          body: `${raffle.title} · Nº ${number}`,
          targetRoles: [],
          targetMemberTypes: [],
          deepLink: "/igreja/sorteio",
          createdById: actorId,
          deliveries: { create: { userId: member.user.id } },
        },
      });
    }
    return ticket;
  });
}

export async function recordRaffleResult(raffleId: string, number: number, reference: string, actorId: string) {
  return withOpenRaffle(raffleId, async (tx, raffle) => {
    const winner = await tx.raffleTicket.findUnique({ where: { raffleId_number: { raffleId, number } } });
    if (!winner?.paidAt) throw new RaffleError("O número contemplado precisa estar reservado e pago.");
    const reservedCount = await tx.raffleTicket.count({ where: { raffleId } });
    const paidCount = await tx.raffleTicket.count({ where: { raffleId, paidAt: { not: null } } });
    return tx.raffleResult.create({
      data: {
        raffleId, winningNumber: number, winnerName: winner.participantName, reference,
        paidCount, reservedCount, raisedCents: paidCount * raffle.priceCents, recordedById: actorId,
      },
    });
  });
}
