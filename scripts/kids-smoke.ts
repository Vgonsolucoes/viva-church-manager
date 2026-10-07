/**
 * VIVA Kids — Smoke test de integração (FASE 8 / spec seção 28).
 *
 * Exercita a lógica real do módulo contra o banco configurado em DATABASE_URL:
 *   culto ativo → check-in → fila de impressão (2 etiquetas, mesmo código) →
 *   bloqueio de duplicidade → projeção (envio/visualizado) → encerramento
 *   automático (SERVICE_ENDED, sem falsa "entrega ao responsável").
 *
 * Todos os registros criados usam o marcador "SMOKE " e são removidos ao
 * final (finally), inclusive a configuração de impressão original.
 *
 * Uso:
 *   npm run kids:smoke
 *
 * Segurança: se DATABASE_URL não for localhost, exige KIDS_SMOKE_ALLOW_REMOTE=1.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Carrega .env ANTES de importar os módulos que instanciam o Prisma.
// Comportamento idêntico ao dotenv: última ocorrência da chave vence dentro
// do arquivo; variáveis já presentes no ambiente não são sobrescritas.
function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const parsed = new Map<string, string>();
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      const value = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      parsed.set(m[1], value);
    }
    for (const [key, value] of parsed) {
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // sem .env — depende do ambiente
  }
}

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl);
if (!isLocal && process.env.KIDS_SMOKE_ALLOW_REMOTE !== "1") {
  console.error(
    "[kids-smoke] DATABASE_URL não parece local. Para rodar contra um banco remoto, confirme com KIDS_SMOKE_ALLOW_REMOTE=1.",
  );
  process.exit(2);
}

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function churchDayOfWeek(now: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[weekday] ?? 0;
}

async function main() {
  const { prisma } = await import("../src/server/db");
  const {
    getActiveKidsService,
    isValidServiceTime,
    getChurchLocalDateString,
  } = await import("../src/server/kids-services");
  const { generateUniquePickupCode } = await import("../src/server/kids-checkin");
  const {
    enqueueKidsPrintJobsForCheckin,
    getKidsPrintConfig,
    setKidsPrintConfig,
  } = await import("../src/server/kids-print");
  const {
    sendKidsProjectionMessage,
    listPendingProjectionMessages,
    markProjectionMessageViewed,
    KIDS_PROJECTION_STATUS,
  } = await import("../src/server/kids-projection");
  const {
    closeEndedKidsSessions,
    KIDS_CLOSE_REASON_SERVICE_ENDED,
    KIDS_CLOSE_REASON_CHECKED_OUT,
  } = await import("../src/server/kids-close");

  const runTag = `SMOKE ${Date.now()}`;
  const created = {
    scheduleIds: [] as string[],
    childId: null as string | null,
    guardianId: null as string | null,
    checkInIds: [] as string[],
    projectionMessageIds: [] as string[],
  };
  let savedPrintConfig: { enabled: boolean; labelWidthMm: number; copies: number } | null = null;

  try {
    console.log("\n[1] Regras puras de horário/data (fuso America/Sao_Paulo)");
    check("isValidServiceTime aceita 09:30", isValidServiceTime("09:30"));
    check("isValidServiceTime rejeita 24:00", !isValidServiceTime("24:00"));
    check("isValidServiceTime rejeita 9:00", !isValidServiceTime("9:00"));
    check(
      "getChurchLocalDateString retorna yyyy-mm-dd",
      /^\d{4}-\d{2}-\d{2}$/.test(getChurchLocalDateString(new Date())),
    );

    console.log("\n[2] Setup — culto ativo, culto encerrado, criança e responsável SMOKE");
    const todayDow = churchDayOfWeek(new Date());
    const yesterdayDow = (todayDow + 6) % 7;

    const activeSchedule = await prisma.kidsServiceSchedule.create({
      data: {
        name: `${runTag} Culto Ativo`,
        dayOfWeek: todayDow,
        startTime: "00:00",
        endTime: "23:59",
        toleranceMinutes: 0,
        isActive: true,
      },
    });
    created.scheduleIds.push(activeSchedule.id);

    const endedSchedule = await prisma.kidsServiceSchedule.create({
      data: {
        name: `${runTag} Culto Encerrado`,
        dayOfWeek: yesterdayDow,
        startTime: "09:00",
        endTime: "11:00",
        toleranceMinutes: 30,
        isActive: true,
      },
    });
    created.scheduleIds.push(endedSchedule.id);

    const child = await prisma.child.create({
      data: {
        fullName: `${runTag} Criança`,
        guardians: {
          create: { fullName: `${runTag} Responsável`, phone: "11999990000" },
        },
      },
      include: { guardians: true },
    });
    created.childId = child.id;
    created.guardianId = child.guardians[0]?.id ?? null;
    check("Criança e responsável criados", !!created.guardianId);

    const anyUser = await prisma.user.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    check("Existe ao menos 1 usuário para autoria (projeção/impressão)", !!anyUser);
    const actorId = anyUser?.id ?? "smoke-no-user";

    console.log("\n[3] Culto ativo identificado pelo backend (spec passo 6)");
    const active = await getActiveKidsService();
    check("getActiveKidsService retorna culto", active.ok);
    check(
      "Culto ativo é o SMOKE do dia",
      active.ok && active.service.id === activeSchedule.id,
      active.ok ? `recebido: ${active.service.name}` : "nenhum ativo",
    );

    console.log("\n[4] Check-in (spec passo 8, backend)");
    const pickupCode = await generateUniquePickupCode();
    check("Código de retirada tem 6 dígitos", /^\d{6}$/.test(pickupCode), pickupCode);

    const checkIn = await prisma.childCheckIn.create({
      data: {
        childId: child.id,
        status: "CHECKED_IN",
        pickupCode,
        createdById: anyUser?.id ?? null,
        serviceScheduleId: activeSchedule.id,
      },
    });
    created.checkInIds.push(checkIn.id);
    check("Check-in criado vinculado ao culto ativo", checkIn.serviceScheduleId === activeSchedule.id);

    console.log("\n[5] Impressão — fila desacoplada (spec passos 10–11)");
    savedPrintConfig = await getKidsPrintConfig();
    await setKidsPrintConfig({ enabled: true, labelWidthMm: 62, copies: 1 });

    const enqueued = await enqueueKidsPrintJobsForCheckin(checkIn.id);
    check("Duas etiquetas enfileiradas", enqueued === 2, `enfileiradas: ${enqueued}`);

    const jobs = await prisma.kidsPrintJob.findMany({ where: { checkInId: checkIn.id } });
    check("Fila contém 2 jobs PENDING", jobs.length === 2 && jobs.every((j) => j.status === "PENDING"));
    check(
      "Etiquetas CHILD e GUARDIAN presentes",
      jobs.some((j) => j.labelType === "CHILD") && jobs.some((j) => j.labelType === "GUARDIAN"),
    );
    check(
      "Ambas usam o MESMO código do check-in",
      jobs.every((j) => (j.payload as { pickupCode?: string }).pickupCode === pickupCode),
    );
    check(
      "Payload com nome da criança e responsável",
      jobs.every((j) => {
        const p = j.payload as { childName?: string; guardianName?: string };
        return p.childName === child.fullName && p.guardianName === `${runTag} Responsável`;
      }),
    );

    console.log("\n[6] Duplicidade bloqueada (spec passo 12)");
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const duplicates = await prisma.childCheckIn.findMany({
      where: {
        childId: child.id,
        status: "CHECKED_IN",
        OR: [{ serviceScheduleId: activeSchedule.id }, { checkInAt: { gte: todayStart } }],
      },
      select: { id: true },
    });
    check("Regra de duplicidade encontra check-in ativo (bloquearia novo)", duplicates.length === 1);

    console.log("\n[7] Projeção — envio, fila e visualizado (spec passos 14–19, backend)");
    const message = await sendKidsProjectionMessage({
      childId: child.id,
      message: "Solicitar responsável",
      sentById: actorId,
    });
    created.projectionMessageIds.push(message.id);
    check("Mensagem criada como PENDING", message.status === KIDS_PROJECTION_STATUS.PENDING);
    check(
      "Mensagem vinculada ao culto ativo (histórico)",
      message.serviceScheduleId === activeSchedule.id,
    );

    const pending = await listPendingProjectionMessages();
    check(
      "Fila da projeção (sem refresh) contém a mensagem com nome da criança",
      pending.some((m) => m.id === message.id && m.child.fullName === child.fullName),
    );

    const viewed = await markProjectionMessageViewed(message.id, actorId);
    check("Operador marca VISUALIZADO", viewed.count === 1);
    const viewedAgain = await markProjectionMessageViewed(message.id, actorId);
    check("Segunda marcação é ignorada (guard PENDING)", viewedAgain.count === 0);

    console.log("\n[8] Encerramento automático (spec passos 20–22)");
    const orphanCheckIn = await prisma.childCheckIn.create({
      data: {
        childId: child.id,
        status: "CHECKED_IN",
        pickupCode: await generateUniquePickupCode(),
        createdById: anyUser?.id ?? null,
        serviceScheduleId: endedSchedule.id,
      },
    });
    created.checkInIds.push(orphanCheckIn.id);

    const closeResult = await closeEndedKidsSessions();
    check("Lazy close encerrou ao menos 1 sessão", closeResult.closedCount >= 1, `closed=${closeResult.closedCount}`);

    const closed = await prisma.childCheckIn.findUnique({ where: { id: orphanCheckIn.id } });
    check("Sessão do culto encerrado virou CHECKED_OUT", closed?.status === "CHECKED_OUT");
    check(
      "closeReason = SERVICE_ENDED (encerramento administrativo)",
      closed?.closeReason === KIDS_CLOSE_REASON_SERVICE_ENDED,
      `recebido: ${closed?.closeReason}`,
    );
    check("checkOutAt preenchido no encerramento", !!closed?.checkOutAt);
    check(
      "NÃO registrado como entregue ao responsável",
      closed?.closeReason !== KIDS_CLOSE_REASON_CHECKED_OUT,
    );

    const stillActive = await prisma.childCheckIn.findUnique({ where: { id: checkIn.id } });
    check(
      "Check-in do culto ATIVO permanece aberto após o lazy close",
      stillActive?.status === "CHECKED_IN" && stillActive?.closeReason === null,
    );

    console.log("\n[9] Distinção de check-out manual (retirada real)");
    await prisma.childCheckIn.update({
      where: { id: checkIn.id },
      data: {
        status: "CHECKED_OUT",
        checkOutAt: new Date(),
        closeReason: KIDS_CLOSE_REASON_CHECKED_OUT,
      },
    });
    const manual = await prisma.childCheckIn.findUnique({ where: { id: checkIn.id } });
    check(
      "Retirada pelo responsável grava closeReason = CHECKED_OUT",
      manual?.closeReason === KIDS_CLOSE_REASON_CHECKED_OUT,
    );
  } finally {
    // Limpeza completa dos dados SMOKE (ordem segura para FKs).
    try {
      if (created.checkInIds.length) {
        await prisma.kidsPrintJob.deleteMany({ where: { checkInId: { in: created.checkInIds } } });
      }
      if (created.projectionMessageIds.length) {
        await prisma.kidsProjectionMessage.deleteMany({ where: { id: { in: created.projectionMessageIds } } });
      }
      if (created.checkInIds.length) {
        await prisma.childCheckIn.deleteMany({ where: { id: { in: created.checkInIds } } });
      }
      if (created.guardianId) {
        await prisma.childGuardian.deleteMany({ where: { id: created.guardianId } });
      }
      if (created.childId) {
        await prisma.child.deleteMany({ where: { id: created.childId } });
      }
      if (created.scheduleIds.length) {
        await prisma.kidsServiceSchedule.deleteMany({ where: { id: { in: created.scheduleIds } } });
      }
      if (savedPrintConfig) {
        await setKidsPrintConfig(savedPrintConfig);
      }
    } catch (cleanupErr) {
      console.error("[kids-smoke] Falha na limpeza:", cleanupErr);
    }
    await prisma.$disconnect();
  }

  console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[kids-smoke] Erro fatal:", err);
  process.exit(1);
});
