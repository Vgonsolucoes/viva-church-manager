import { z } from "zod";

export const ARRIVAL_CONFIG_KEY = "service-arrival:v1";
export const ABSENCE_AFTER_MINUTES = 40;
export const arrivalConfigSchema = z
  .object({
    enabled: z.boolean(),
    address: z.string().trim().max(300),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    radiusMeters: z.number().int().min(50).max(1000),
    beforeMinutes: z.number().int().min(0).max(180),
    durationMinutes: z.number().int().min(40).max(360),
  })
  .refine(
    (config) =>
      !config.enabled ||
      (config.latitude !== null && config.longitude !== null),
    { message: "Informe a posição da igreja." },
  );
export type ArrivalConfig = z.infer<typeof arrivalConfigSchema>;
export const defaultArrivalConfig: ArrivalConfig = {
  enabled: true,
  address:
    "Av. Carmelita Drumond Diniz, 770 - Parque Maracanã, Contagem - MG, 32042-430",
  latitude: -19.8984834,
  longitude: -44.075543,
  radiusMeters: 100,
  beforeMinutes: 60,
  durationMinutes: 180,
};
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const radians = Math.PI / 180;
  const latitude = (b.latitude - a.latitude) * radians;
  const longitude = (b.longitude - a.longitude) * radians;
  const haversine =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(longitude / 2) ** 2;
  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)))
  );
}
export function arrivalWindow(
  event: { startsAt: Date; endsAt: Date | null },
  config: ArrivalConfig,
) {
  return {
    from: new Date(event.startsAt.getTime() - config.beforeMinutes * 60000),
    to:
      event.endsAt ??
      new Date(event.startsAt.getTime() + config.durationMinutes * 60000),
  };
}
export function volunteerArrivalStatus(
  arrivedAt: Date | null,
  startsAt: Date,
  now = new Date(),
) {
  if (arrivedAt) return "ARRIVED" as const;
  return now.getTime() >= startsAt.getTime() + ABSENCE_AFTER_MINUTES * 60000
    ? ("ABSENT" as const)
    : ("WAITING" as const);
}
export const arrivalObservationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100),
  observedAt: z.coerce.date(),
  action: z.enum(["ENTER", "EXIT", "PING"]).default("ENTER"),
});
