import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import {
  getActiveKidsService,
  getChurchLocalDateString,
} from "@/server/kids-services";

// Motivos de encerramento de um check-in Kids (ChildCheckIn.closeReason).
export const KIDS_CLOSE_REASON_SERVICE_ENDED = "SERVICE_ENDED";
export const KIDS_CLOSE_REASON_CHECKED_OUT = "CHECKED_OUT";

/**
 * Encerramento automático ("lazy close") das sessões Kids.
 *
 * Regra (spec seção 14): ao atingir o horário final do culto, os check-ins
 * ainda ativos devem ser fechados administrativamente com
 * closeReason = SERVICE_ENDED — sem cron e sem jamais apresentar esses
 * registros como "Criança entregue ao responsável".
 *
 * Como não há cron, a rotina roda de forma preguiçosa nos pontos de leitura
 * e escrita do módulo (app, painel, check-in/out). É idempotente e
 * best-effort: falhas são logadas e nunca quebram o fluxo do chamador.
 *
 * Lógica:
 * - Check-in vinculado a um culto que NÃO é o culto ativo agora pertence a
 *   uma ocorrência já encerrada (se o culto de hoje ainda não começou, o
 *   registro aberto é de uma ocorrência passada) → encerra.
 * - Check-in sem culto vinculado (manual/legado) → encerra quando foi feito
 *   em dia anterior ao dia atual da igreja (America/Sao_Paulo).
 */
export async function closeEndedKidsSessions(
  now = new Date(),
): Promise<{ closedCount: number }> {
  try {
    const active = await getActiveKidsService(now);
    const activeId = active.ok ? active.service.id : null;
    const todayStr = getChurchLocalDateString(now);

    const openCheckIns = await prisma.childCheckIn.findMany({
      where: { status: "CHECKED_IN" },
      select: { id: true, serviceScheduleId: true, checkInAt: true },
    });
    if (!openCheckIns.length) return { closedCount: 0 };

    const toClose = openCheckIns
      .filter((c) =>
        c.serviceScheduleId
          ? c.serviceScheduleId !== activeId
          : getChurchLocalDateString(c.checkInAt) < todayStr,
      )
      .map((c) => c.id);

    if (!toClose.length) return { closedCount: 0 };

    await prisma.childCheckIn.updateMany({
      where: { id: { in: toClose }, status: "CHECKED_IN" },
      data: {
        status: "CHECKED_OUT",
        checkOutAt: now,
        closeReason: KIDS_CLOSE_REASON_SERVICE_ENDED,
      },
    });

    await logAudit({
      actorUserId: null,
      action: "AUTO_CLOSE_SERVICE_ENDED",
      entityType: "ChildCheckIn",
      after: {
        count: toClose.length,
        checkInIds: toClose,
        closeReason: KIDS_CLOSE_REASON_SERVICE_ENDED,
      },
    });

    return { closedCount: toClose.length };
  } catch (err) {
    console.error("[kids-close] Falha no encerramento automático:", err);
    return { closedCount: 0 };
  }
}
