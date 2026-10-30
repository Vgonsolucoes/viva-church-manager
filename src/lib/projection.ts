import { z } from "zod";
export const projectionChannelSchema = z.enum(["KIDS", "PARKING"]);
export type ProjectionChannel = z.infer<typeof projectionChannelSchema>;
export type ProjectionAccess = { KIDS: boolean; PARKING: boolean };
export function accessFromMinistries(ministries: ReadonlyArray<{ active: boolean; projectionChannel: string | null }>): ProjectionAccess {
  return {
    KIDS: ministries.some(m => m.active && m.projectionChannel === "KIDS"),
    PARKING: ministries.some(m => m.active && m.projectionChannel === "PARKING"),
  };
}
export const projectionRequestSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("KIDS"), childId: z.string().min(1), message: z.string().trim().min(3).max(240) }),
  z.object({
    channel: z.literal("PARKING"),
    plate: z.string().transform(s => s.toUpperCase().replace(/[\s-]/g, "")).pipe(z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, "Informe uma placa válida, como ABC1234 ou ABC1D23.")),
    vehicle: z.string().trim().max(80).optional().default(""),
    color: z.string().trim().max(30).optional().default(""),
    location: z.string().trim().min(3).max(80).default("Estacionamento da igreja"),
    message: z.string().trim().min(3).max(240).default("Solicitamos que o proprietário compareça ao estacionamento."),
  }),
]);
