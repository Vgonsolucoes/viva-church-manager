import { prisma } from "@/server/db";
import { getActiveKidsService } from "@/server/kids-services";

// ---------------------------------------------------------------------------
// Comunicação Kids → Projeção (seções 15–23 da spec).
// Unidirecional: o voluntário envia; a tela da projeção recebe e o operador
// marca VISUALIZADO. Não existe resposta/chat de retorno.
//
// As constantes de UI (presets/limite) vivem em "@/lib/kids-projection" para
// poderem ser usadas também por Client Components.
// ---------------------------------------------------------------------------

export const KIDS_PROJECTION_STATUS = {
  PENDING: "PENDING",
  VIEWED: "VIEWED",
} as const;
export type KidsProjectionStatus =
  (typeof KIDS_PROJECTION_STATUS)[keyof typeof KIDS_PROJECTION_STATUS];

export async function sendKidsProjectionMessage(input: {
  childId: string;
  message: string;
  sentById: string;
}) {
  // Vincula ao culto ativo quando houver — histórico exibe o culto (seção 23).
  const active = await getActiveKidsService();
  const serviceScheduleId = active.ok ? active.service.id : null;

  return prisma.kidsProjectionMessage.create({
    data: {
      childId: input.childId,
      message: input.message,
      sentById: input.sentById,
      serviceScheduleId,
    },
  });
}

/** Fila da tela de projeção: mensagens ainda não visualizadas, FIFO. */
export async function listPendingProjectionMessages(take = 20) {
  return prisma.kidsProjectionMessage.findMany({
    where: { status: KIDS_PROJECTION_STATUS.PENDING },
    orderBy: { sentAt: "asc" },
    take: Math.min(50, Math.max(1, take)),
    select: {
      id: true,
      message: true,
      sentAt: true,
      child: { select: { fullName: true } },
    },
  });
}

export async function markProjectionMessageViewed(id: string, viewedById: string) {
  return prisma.kidsProjectionMessage.updateMany({
    where: { id, status: KIDS_PROJECTION_STATUS.PENDING },
    data: {
      status: KIDS_PROJECTION_STATUS.VIEWED,
      viewedAt: new Date(),
      viewedById,
    },
  });
}
