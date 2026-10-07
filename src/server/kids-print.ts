import { prisma } from "@/server/db";

// ---------------------------------------------------------------------------
// Configuração (AppSetting) — permite ajustar impressão sem redeploy.
// Prioridade: valor persistido no PostgreSQL; fallback para env; default fixo.
// ---------------------------------------------------------------------------

export const KIDS_PRINT_ENABLED_KEY = "kidsPrintEnabled";
export const KIDS_PRINT_LABEL_WIDTH_KEY = "kidsPrintLabelWidthMm";
export const KIDS_PRINT_COPIES_KEY = "kidsPrintCopies";

export const KIDS_LABEL_TYPES = ["CHILD", "GUARDIAN"] as const;
export type KidsLabelType = (typeof KIDS_LABEL_TYPES)[number];

export const KIDS_PRINT_JOB_STATUS = {
  PENDING: "PENDING",
  PRINTED: "PRINTED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type KidsPrintJobStatus =
  (typeof KIDS_PRINT_JOB_STATUS)[keyof typeof KIDS_PRINT_JOB_STATUS];

export type KidsPrintConfig = {
  enabled: boolean;
  labelWidthMm: number;
  copies: number;
};

const DEFAULT_CONFIG: KidsPrintConfig = {
  enabled: true,
  labelWidthMm: 62,
  copies: 1,
};

export type KidsLabelPayload = {
  labelType: KidsLabelType;
  childName: string;
  guardianName: string | null;
  pickupCode: string;
  serviceName: string | null;
  checkInAt: string; // ISO — snapshot do momento do check-in
};

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function getKidsPrintConfig(): Promise<KidsPrintConfig> {
  try {
    const rows = await prisma.appSetting.findMany({
      where: {
        key: { in: [KIDS_PRINT_ENABLED_KEY, KIDS_PRINT_LABEL_WIDTH_KEY, KIDS_PRINT_COPIES_KEY] },
      },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const enabledRaw =
      map.get(KIDS_PRINT_ENABLED_KEY) ?? process.env.KIDS_PRINT_ENABLED ?? null;
    const widthRaw =
      map.get(KIDS_PRINT_LABEL_WIDTH_KEY) ?? process.env.KIDS_PRINT_LABEL_WIDTH_MM ?? null;
    const copiesRaw =
      map.get(KIDS_PRINT_COPIES_KEY) ?? process.env.KIDS_PRINT_COPIES ?? null;

    return {
      enabled: enabledRaw === null ? DEFAULT_CONFIG.enabled : enabledRaw === "true",
      labelWidthMm: clampInt(
        Number(widthRaw),
        30,
        120,
        DEFAULT_CONFIG.labelWidthMm,
      ),
      copies: clampInt(Number(copiesRaw), 1, 4, DEFAULT_CONFIG.copies),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setKidsPrintConfig(config: KidsPrintConfig): Promise<void> {
  const entries: Array<[string, string]> = [
    [KIDS_PRINT_ENABLED_KEY, config.enabled ? "true" : "false"],
    [KIDS_PRINT_LABEL_WIDTH_KEY, String(config.labelWidthMm)],
    [KIDS_PRINT_COPIES_KEY, String(config.copies)],
  ];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Fila desacoplada (Check-in → PrintJob → KidsLabelService → Impressora)
// ---------------------------------------------------------------------------

/**
 * Enfileira as DUAS etiquetas de um check-in confirmado (seções 9 e 10):
 * ETIQUETA 1 — CRIANÇA (nome grande + responsável + código)
 * ETIQUETA 2 — RESPONSÁVEL (nome da criança + MESMO código do mesmo check-in)
 *
 * Nunca lança erro para o fluxo de check-in: falhas de impressão não podem
 * impedir a entrada da criança. Retorna quantos jobs foram enfileirados.
 */
export async function enqueueKidsPrintJobsForCheckin(checkInId: string): Promise<number> {
  const config = await getKidsPrintConfig();
  if (!config.enabled) return 0;

  const checkIn = await prisma.childCheckIn.findUnique({
    where: { id: checkInId },
    include: {
      child: {
        select: {
          id: true,
          fullName: true,
          guardians: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { fullName: true },
          },
        },
      },
      serviceSchedule: { select: { name: true } },
    },
  });
  if (!checkIn) return 0;

  const guardianName = checkIn.child.guardians[0]?.fullName ?? null;
  const basePayload: Omit<KidsLabelPayload, "labelType"> = {
    childName: checkIn.child.fullName,
    guardianName,
    pickupCode: checkIn.pickupCode,
    serviceName: checkIn.serviceSchedule?.name ?? null,
    checkInAt: checkIn.checkInAt.toISOString(),
  };

  await prisma.kidsPrintJob.createMany({
    data: KIDS_LABEL_TYPES.map((labelType) => ({
      checkInId: checkIn.id,
      childId: checkIn.child.id,
      labelType,
      copies: config.copies,
      payload: { ...basePayload, labelType },
    })),
  });

  return KIDS_LABEL_TYPES.length;
}

export async function listPendingKidsPrintJobs(take = 10) {
  return prisma.kidsPrintJob.findMany({
    where: { status: KIDS_PRINT_JOB_STATUS.PENDING },
    orderBy: { createdAt: "asc" },
    take: Math.min(50, Math.max(1, take)),
    select: {
      id: true,
      labelType: true,
      copies: true,
      payload: true,
      createdAt: true,
    },
  });
}

export async function markKidsPrintJobPrinted(jobId: string, userId: string) {
  return prisma.kidsPrintJob.updateMany({
    where: { id: jobId, status: KIDS_PRINT_JOB_STATUS.PENDING },
    data: {
      status: KIDS_PRINT_JOB_STATUS.PRINTED,
      printedAt: new Date(),
      printedById: userId,
      attempts: { increment: 1 },
      error: null,
    },
  });
}

export async function markKidsPrintJobFailed(jobId: string, userId: string, error: string) {
  return prisma.kidsPrintJob.updateMany({
    where: { id: jobId, status: KIDS_PRINT_JOB_STATUS.PENDING },
    data: {
      status: KIDS_PRINT_JOB_STATUS.FAILED,
      printedById: userId,
      attempts: { increment: 1 },
      error: error.slice(0, 500),
    },
  });
}
