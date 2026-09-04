import { z } from "zod";

export const RoleKeySchema = z.enum([
  "SUPER_ADMIN",
  "PASTOR_PRESIDENTE",
  "PASTOR",
  "MINISTRY_LEADER",
  "CELL_LEADER",
  "VOLUNTEER",
  "MEMBER",
  "FINANCE",
  "SECRETARY",
  "RECEPTION",
  "KIDS_MINISTRY",
  "PARKING",
]);
export type RoleKey = z.infer<typeof RoleKeySchema>;

const PermissionKeyLiteral = z.string();
export type PermissionKey =
  | "admin:access"
  | "dashboard:view"
  | "members:read"
  | "members:write"
  | "volunteers:read"
  | "volunteers:write"
  | "schedules:read"
  | "schedules:write"
  | "ministries:read"
  | "ministries:write"
  | "calendar:read"
  | "calendar:write"
  | "events:read"
  | "events:write"
  | "courses:read"
  | "courses:write"
  | "followup:read"
  | "followup:write"
  | "cells:read"
  | "cells:write"
  | "discipleships:read"
  | "discipleships:write"
  | "kids:read"
  | "kids:write"
  | "assets:read"
  | "assets:write"
  | "lostfound:read"
  | "lostfound:write"
  | "finance:read"
  | "finance:write"
  | "budget:read"
  | "budget:write"
  | "notifications:read"
  | "notifications:write"
  | "reports:view"
  | "settings:manage"
  | "pastoral:notes:read"
  | "pastoral:notes:write"
  | "youtube:read"
  | "youtube:write";

export const MemberPayloadSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  photoUrl: z.string().nullable(),
  phone: z.string().nullable(),
  cpf: z.string().nullable(),
  birthDate: z.coerce.date().nullable(),
  joinedAt: z.coerce.date().nullable(),
  ministryId: z.string().nullable(),
  participatesInCell: z.boolean(),
});
export type MemberPayload = z.infer<typeof MemberPayloadSchema>;

export const MeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
  roles: z.array(RoleKeySchema.or(z.string())),
  permissions: z.array(PermissionKeyLiteral),
  member: MemberPayloadSchema.nullable(),
  ministries: z.array(z.object({ id: z.string(), name: z.string() })),
  leadingCellIds: z.array(z.string()),
  syncedAt: z.coerce.date(),
});
export type Me = z.infer<typeof MeSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email("E-mail inválido").min(5).max(255),
  password: z.string().min(1, "Informe a senha").max(255),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.coerce.date(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    image: z.string().nullable(),
    roles: z.array(z.string()),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const EventPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  location: z.string().nullable(),
  bannerImageUrl: z.string().nullable(),
  capacity: z.number().int().nullable(),
  isPaid: z.boolean().nullable(),
  ticketPriceCents: z.number().int().nullable(),
  allowPix: z.boolean().nullable(),
  allowCreditCard: z.boolean().nullable(),
});
export type EventPublic = z.infer<typeof EventPublicSchema>;

export const CellPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  weekday: z.number().int(),
  time: z.string(),
  address: z.string().nullable(),
  leaderName: z.string(),
});
export type CellPublic = z.infer<typeof CellPublicSchema>;

export type ApiErrorShape = {
  error: string;
  issues?: Record<string, string[] | undefined>;
  message?: string;
};
