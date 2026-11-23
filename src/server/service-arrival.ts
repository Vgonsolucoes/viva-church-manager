import { prisma } from "@/server/db";
import {
  arrivalConfigSchema,
  defaultArrivalConfig,
  ARRIVAL_CONFIG_KEY,
  arrivalWindow,
  distanceMeters,
  type ArrivalConfig,
  type arrivalObservationSchema,
} from "@/lib/service-arrival";
import type { z } from "zod";
import { ensureWeeklyServices } from "@/server/weekly-services";

export async function getArrivalConfig(): Promise<ArrivalConfig> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: ARRIVAL_CONFIG_KEY },
  });
  if (!setting) return defaultArrivalConfig;
  let value: unknown;
  try {
    value = JSON.parse(setting.value);
  } catch {
    return defaultArrivalConfig;
  }
  const parsed = arrivalConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultArrivalConfig;
}

export async function recordGeoArrival(
  memberId: string,
  observation: z.infer<typeof arrivalObservationSchema>,
  now = new Date(),
) {
  const consent = await prisma.arrivalConsent.findUnique({
    where: { memberId },
  });
  if (!consent?.enabled)
    return {
      ok: false,
      message: "Ative a confirmação de chegada no aplicativo.",
      code: "CONSENT_REQUIRED",
    };
  const config = await getArrivalConfig();
  if (
    !config.enabled ||
    config.latitude === null ||
    config.longitude === null
  ) {
    return {
      ok: false,
      message: "A localização da igreja ainda não está ativada.",
      code: "NOT_CONFIGURED",
    };
  }
  const age = now.getTime() - observation.observedAt.getTime();
  if (age < -30000 || age > 15 * 60000)
    return {
      ok: false,
      message: "Atualize a localização e tente novamente.",
      code: "STALE_LOCATION",
    };
  const distance = distanceMeters(observation, {
    latitude: config.latitude,
    longitude: config.longitude,
  });
  const inside = distance <= config.radiusMeters;
  if (observation.action !== "EXIT" && !inside)
    return {
      ok: false,
      message: "Você ainda está fora da área de chegada da igreja.",
      code: "OUTSIDE",
    };
  if (observation.action === "EXIT" && inside)
    return { ok: true, count: 0, message: "Localização atualizada." };
  await ensureWeeklyServices(now);
  const candidates = await prisma.event.findMany({
    where: {
      type: "SERVICE",
      geoCheckIn: true,
      startsAt: {
        gte: new Date(observation.observedAt.getTime() - 24 * 3600000),
        lte: new Date(
          observation.observedAt.getTime() + config.beforeMinutes * 60000,
        ),
      },
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  const services = candidates.filter((event) => {
    const window = arrivalWindow(event, config);
    return (
      observation.observedAt >= window.from &&
      observation.observedAt <= window.to
    );
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // Recheck consent inside the write transaction so a withdrawn opt-in cannot be reused.
          const currentConsent = await tx.arrivalConsent.findUnique({
            where: { memberId },
          });
          if (!currentConsent?.enabled)
            throw new Error("ARRIVAL_CONSENT_REVOKED");
          for (const event of services) {
            const where = { eventId_memberId: { eventId: event.id, memberId } };
            const existing = await tx.servicePresence.findUnique({ where });
            if (existing && existing.lastSeenAt > observation.observedAt)
              continue;
            if (observation.action === "EXIT") {
              if (existing)
                await tx.servicePresence.update({
                  where,
                  data: {
                    leftAt: observation.observedAt,
                    lastSeenAt: observation.observedAt,
                  },
                });
            } else {
              await tx.servicePresence.upsert({
                where,
                create: {
                  eventId: event.id,
                  memberId,
                  arrivedAt: observation.observedAt,
                  lastSeenAt: observation.observedAt,
                  method: "GEO",
                },
                update: {
                  lastSeenAt: observation.observedAt,
                  leftAt: null,
                  method: "GEO",
                },
              });
            }
          }
        },
        { isolationLevel: "Serializable" },
      );
      break;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "ARRIVAL_CONSENT_REVOKED"
      ) {
        return {
          ok: false,
          message: "A autorização de localização foi desativada.",
          code: "CONSENT_REQUIRED",
        };
      }
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "P2034" || error.code === "P2002") &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  return {
    ok: true,
    count: services.length,
    message: services.length
      ? observation.action === "EXIT"
        ? "Sua saída foi registrada."
        : "Sua chegada foi registrada."
      : "Não há culto com check-in aberto neste horário.",
  };
}
