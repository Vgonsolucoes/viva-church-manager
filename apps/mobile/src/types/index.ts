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
  | "schedules:confirm"
  | "substitution:request"
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
  | "discipleship:my:read"
  | "discipleship:my:write"
  | "kids:read"
  | "kids:write"
  | "kids:checkin:self"
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
  | "youtube:write"
  | "prayer:read"
  | "prayer:write"
  | "profile:self:edit";

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

export type ScheduleAssignmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "SUBSTITUTE_REQUESTED";

export const ScheduleDeclineReasonSchema = z.enum([
  "TRABALHO",
  "VIAGEM",
  "FAMILIAR",
  "SAUDE",
  "OUTRO",
]);
export type ScheduleDeclineReason = z.infer<typeof ScheduleDeclineReasonSchema>;

export const VolunteerAvailabilityReasonSchema = z.enum([
  "DISPONIVEL",
  "INDISPONIVEL",
  "VIAGEM",
  "FERIAS",
  "TRABALHO",
  "OUTRO",
]);
export type VolunteerAvailabilityReason = z.infer<
  typeof VolunteerAvailabilityReasonSchema
>;

export const ScheduleSubstitutionStatusSchema = z.enum([
  "REQUESTED",
  "VOLUNTEER_B_ACCEPTED",
  "APPROVED_BY_LEADER",
  "REJECTED",
]);
export type ScheduleSubstitutionStatus = z.infer<
  typeof ScheduleSubstitutionStatusSchema
>;

export const PrayerRequestPrivacySchema = z.enum([
  "PRIVADO",
  "PASTORES",
  "LIDERANCA",
  "PUBLICO",
]);
export type PrayerRequestPrivacy = z.infer<
  typeof PrayerRequestPrivacySchema
>;

export const ScheduleAssignmentSchema = z.object({
  id: z.string(),
  scheduleId: z.string(),
  volunteerId: z.string(),
  roleName: z.string(),
  status: z.string(),
  confirmedAt: z.coerce.date().nullable(),
  schedule: z
    .object({
      id: z.string(),
      title: z.string(),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date().nullable(),
      ministryId: z.string().nullable(),
      location: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type ScheduleAssignment = z.infer<typeof ScheduleAssignmentSchema>;

export const VolunteerAvailabilityBlockSchema = z.object({
  id: z.string(),
  volunteerId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  reason: VolunteerAvailabilityReasonSchema,
  note: z.string().nullable(),
});
export type VolunteerAvailabilityBlock = z.infer<
  typeof VolunteerAvailabilityBlockSchema
>;

export const ScheduleSubstitutionRequestSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  fromVolunteerId: z.string(),
  toVolunteerId: z.string(),
  status: ScheduleSubstitutionStatusSchema,
  reason: ScheduleDeclineReasonSchema,
  note: z.string().nullable(),
  approvedAt: z.coerce.date().nullable(),
});
export type ScheduleSubstitutionRequest = z.infer<
  typeof ScheduleSubstitutionRequestSchema
>;

export const AgendaCategorySchema = z.enum([
  "CULTO",
  "EVENTO",
  "CELULA",
  "REUNIAO",
  "DISCIPULADO",
  "ENSAIO",
  "ESCALA",
  "CONFERENCIA",
]);
export type AgendaCategory = z.infer<typeof AgendaCategorySchema>;

export const AgendaItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: AgendaCategorySchema,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string(),
});
export type AgendaItem = z.infer<typeof AgendaItemSchema>;

export const CellDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  weekday: z.number().int(),
  time: z.string(),
  address: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  leaderId: z.string(),
  leaderName: z.string(),
  leaderPhone: z.string().nullable(),
  nextMeetingDate: z.coerce.date().nullable(),
  membersCount: z.number().int(),
});
export type CellDetail = z.infer<typeof CellDetailSchema>;

export const CellMeetingSchema = z.object({
  id: z.string(),
  cellId: z.string(),
  date: z.coerce.date(),
  theme: z.string().nullable(),
  participantsCount: z.number().int().nullable(),
  visitorsCount: z.number().int().nullable(),
});
export type CellMeeting = z.infer<typeof CellMeetingSchema>;

export const DiscipleshipSchema = z.object({
  id: z.string(),
  discipleId: z.string(),
  discipleName: z.string(),
  disciplerId: z.string(),
  disciplerName: z.string(),
  stage: z.string().nullable(),
  startDate: z.coerce.date().nullable(),
  lastMeetingAt: z.coerce.date().nullable(),
  nextMeetingAt: z.coerce.date().nullable(),
});
export type Discipleship = z.infer<typeof DiscipleshipSchema>;

export const DiscipleshipMeetingSchema = z.object({
  id: z.string(),
  discipleshipId: z.string(),
  date: z.coerce.date(),
  theme: z.string().nullable(),
  notes: z.string().nullable(),
  nextTheme: z.string().nullable(),
  nextDate: z.coerce.date().nullable(),
  status: z.string().nullable(),
});
export type DiscipleshipMeeting = z.infer<typeof DiscipleshipMeetingSchema>;

export type DiscipleshipNetworkNode = {
  memberId: string;
  name: string;
  photoUrl: string | null;
  stage: string | null;
  disciples: DiscipleshipNetworkNode[];
};

const BaseDiscipleshipNetworkNodeSchema = z.object({
  memberId: z.string(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  stage: z.string().nullable(),
});

export const DiscipleshipNetworkNodeSchema: z.ZodType<DiscipleshipNetworkNode> =
  BaseDiscipleshipNetworkNodeSchema.extend({
    disciples: z.lazy(
      () => z.array(DiscipleshipNetworkNodeSchema) as z.ZodType<DiscipleshipNetworkNode[]>,
    ),
  });

export const MinistrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  leaderName: z.string().nullable(),
});
export type Ministry = z.infer<typeof MinistrySchema>;

export const ChildSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  birthDate: z.coerce.date().nullable(),
  classroom: z.string().nullable(),
  photoUrl: z.string().nullable(),
  guardians: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      phone: z.string().nullable(),
      relationship: z.string().nullable(),
    }),
  ),
});
export type Child = z.infer<typeof ChildSchema>;

export const ChildCheckInSchema = z.object({
  id: z.string(),
  childId: z.string(),
  status: z.enum(["CHECKED_IN", "CHECKED_OUT"]),
  pickupCode: z.string(),
  checkInAt: z.coerce.date(),
  checkOutAt: z.coerce.date().nullable(),
});
export type ChildCheckIn = z.infer<typeof ChildCheckInSchema>;

export const PrayerRequestSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  category: z.string().nullable(),
  privacy: PrayerRequestPrivacySchema,
  answered: z.boolean(),
  createdAt: z.coerce.date(),
  member: z
    .object({
      id: z.string(),
      fullName: z.string(),
      photoUrl: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type PrayerRequest = z.infer<typeof PrayerRequestSchema>;

export const FundraisingProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  bannerImageUrl: z.string().nullable(),
  goalCents: z.number().int(),
  raisedCents: z.number().int(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
});
export type FundraisingProject = z.infer<typeof FundraisingProjectSchema>;

export const QrMemberCardSchema = z.object({
  memberId: z.string(),
  fullName: z.string(),
  memberNumber: z.string().nullable(),
  photoUrl: z.string().nullable(),
  qrToken: z.string(),
  expiresAt: z.coerce.date(),
});
export type QrMemberCard = z.infer<typeof QrMemberCardSchema>;

export const QrScanResultSchema = z.object({
  valid: z.boolean(),
  type: z.enum(["MEMBER_CARD", "CHECK_IN", "EVENT_TICKET", "UNKNOWN"]),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  photoUrl: z.string().nullable(),
  scannedAt: z.coerce.date(),
});
export type QrScanResult = z.infer<typeof QrScanResultSchema>;

export const EventRegistrationSchema = z.object({
  saleId: z.string(),
  eventId: z.string(),
  ticket: z.object({
    qr_token_placeholder: z.string(),
  }),
});
export type EventRegistration = z.infer<typeof EventRegistrationSchema>;

export const ProfilePatchSchema = z.object({
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  neighborhood: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  zip: z.string().length(8).nullable().optional(),
});
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;
