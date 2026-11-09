"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertWebPermission } from "@/server/access-control";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { RaffleError, recordRaffleResult, reserveRaffleTicket, withOpenRaffle } from "@/server/raffles";

const number = z.string().regex(/^\d{1,5}$/).transform(Number);
const text = (max: number) => z.string().trim().min(1).max(max);
const price = z.string().trim().regex(/^\d{1,5}(?:[,.]\d{1,2})?$/)
  .transform((value) => Math.round(Number(value.replace(",", ".")) * 100))
  .pipe(z.number().min(1).max(100000));
const createSchema = z.object({ title: text(120), prize: text(240), firstNumber: number, lastNumber: number, price });
const reservationSchema = z.object({ number, memberId: z.string().max(100), participantName: z.string().trim().max(160) });

export async function createRaffle(form: FormData) {
  const session = await assertWebPermission("raffles:write");
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return "Informe título, prêmio, faixa numérica e valor entre R$ 0,01 e R$ 1.000,00.";
  const { price: priceCents, ...data } = parsed.data;
  if (data.lastNumber < data.firstNumber || data.lastNumber - data.firstNumber >= 10000) {
    return "Informe uma faixa com até 10.000 números, do menor para o maior.";
  }
  const raffle = await prisma.raffle.create({ data: { ...data, priceCents } });
  await logAudit({ actorUserId: session.uid, action: "RAFFLE_CREATED", entityType: "Raffle", entityId: raffle.id });
  revalidatePath("/admin/sorteio");
  redirect(`/admin/sorteio/${raffle.id}`);
}

export async function openRaffle(id: string, form: FormData) {
  const session = await assertWebPermission("raffles:write");
  const authorization = text(120).safeParse(form.get("authorization"));
  if (!authorization.success) return "Informe o número do certificado de autorização.";
  const updated = await prisma.raffle.updateMany({ where: { id, authorization: null, result: null }, data: { authorization: authorization.data } });
  if (!updated.count) return "Este sorteio não está disponível para abertura.";
  await logAudit({ actorUserId: session.uid, action: "RAFFLE_OPENED", entityType: "Raffle", entityId: id });
  revalidatePath(`/admin/sorteio/${id}`);
}

export async function reserveNumber(id: string, form: FormData) {
  const session = await assertWebPermission("raffles:write");
  const parsed = reservationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return "Confira o número e o nome do participante.";
  try {
    const { number, memberId, participantName } = parsed.data;
    await reserveRaffleTicket(id, number, memberId, participantName, session.uid);
  } catch (error) {
    if (error instanceof RaffleError) return error.message;
    throw error;
  }
  revalidatePath(`/admin/sorteio/${id}`);
}

export async function setPayment(id: string, ticketId: string, paid: boolean) {
  const session = await assertWebPermission("raffles:write");
  try {
    await withOpenRaffle(id, async (tx) => {
      const updated = await tx.raffleTicket.updateMany({
        where: { id: ticketId, raffleId: id, paidAt: paid ? null : { not: null } },
        data: { paidAt: paid ? new Date() : null },
      });
      if (!updated.count) throw new RaffleError("O pagamento já foi atualizado. Confira a situação atual.");
    });
  } catch (error) {
    if (error instanceof RaffleError) return error.message;
    throw error;
  }
  await logAudit({ actorUserId: session.uid, action: paid ? "RAFFLE_PAYMENT_CONFIRMED" : "RAFFLE_PAYMENT_REVERSED", entityType: "RaffleTicket", entityId: ticketId });
  revalidatePath(`/admin/sorteio/${id}`);
}

export async function closeRaffle(id: string, form: FormData) {
  const session = await assertWebPermission("raffles:write");
  const parsed = z.object({ number, reference: text(240), confirmed: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return "Informe o número, a referência do resultado e confirme o encerramento.";
  try {
    await recordRaffleResult(id, parsed.data.number, parsed.data.reference, session.uid);
  } catch (error) {
    if (error instanceof RaffleError) return error.message;
    throw error;
  }
  revalidatePath(`/admin/sorteio/${id}`);
  revalidatePath(`/admin/sorteio/${id}/apuracao`);
}
