import { api } from "@/services/api/client";
import {
  ScheduleAssignmentSchema,
  ScheduleSubstitutionRequestSchema,
  VolunteerAvailabilityBlockSchema,
  type ScheduleAssignment,
  type ScheduleSubstitutionRequest,
  type VolunteerAvailabilityBlock,
  type ScheduleDeclineReason,
} from "@/types";

export async function listMySchedules(): Promise<ScheduleAssignment[]> {
  const res = await api.get<unknown>("/api/v1/schedules/my");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => ScheduleAssignmentSchema.parse(item));
}

export async function confirmSchedule(id: string): Promise<ScheduleAssignment> {
  const res = await api.post<unknown>(`/api/v1/schedules/${id}/confirm`);
  return ScheduleAssignmentSchema.parse(res);
}

export async function declineSchedule(id: string, reason?: ScheduleDeclineReason, note?: string): Promise<ScheduleAssignment>;
export async function declineSchedule(id: string, payload?: { reason?: ScheduleDeclineReason; note?: string | null }): Promise<ScheduleAssignment>;
export async function declineSchedule(
  id: string,
  reasonOrPayload?: ScheduleDeclineReason | { reason?: ScheduleDeclineReason; note?: string | null },
  noteArg?: string,
): Promise<ScheduleAssignment> {
  let reason: ScheduleDeclineReason | undefined;
  let note: string | null | undefined;
  if (reasonOrPayload && typeof reasonOrPayload === "object") {
    reason = reasonOrPayload.reason;
    note = reasonOrPayload.note;
  } else {
    reason = reasonOrPayload;
    note = noteArg;
  }
  const res = await api.post<unknown>(`/api/v1/schedules/${id}/refuse`, { reason, note });
  return ScheduleAssignmentSchema.parse(res);
}

export async function refuseSchedule(id: string, reason?: ScheduleDeclineReason, note?: string): Promise<ScheduleAssignment>;
export async function refuseSchedule(id: string, payload?: { reason?: ScheduleDeclineReason; note?: string | null }): Promise<ScheduleAssignment>;
export async function refuseSchedule(
  id: string,
  reasonOrPayload?: ScheduleDeclineReason | { reason?: ScheduleDeclineReason; note?: string | null },
  noteArg?: string,
): Promise<ScheduleAssignment> {
  return (declineSchedule as any)(id, reasonOrPayload, noteArg);
}

export async function requestSubstitution(
  idOrInput:
    | string
    | {
        assignmentId: string;
        toVolunteerId: string;
        reason: ScheduleDeclineReason;
        note?: string | null;
      },
  payload?: {
    toVolunteerId: string;
    reason: ScheduleDeclineReason;
    note?: string | null;
  },
): Promise<ScheduleSubstitutionRequest> {
  let assignmentId: string;
  let toVolunteerId: string;
  let reason: ScheduleDeclineReason;
  let note: string | null | undefined;
  if (typeof idOrInput === "object") {
    assignmentId = idOrInput.assignmentId;
    toVolunteerId = idOrInput.toVolunteerId;
    reason = idOrInput.reason;
    note = idOrInput.note;
  } else {
    assignmentId = idOrInput;
    toVolunteerId = payload!.toVolunteerId;
    reason = payload!.reason;
    note = payload!.note;
  }
  const res = await api.post<unknown>("/api/v1/schedules/substitution-requests", {
    assignmentId,
    toVolunteerId,
    reason,
    note,
  });
  return ScheduleSubstitutionRequestSchema.parse(res);
}

export async function listAvailableVolunteers(
  assignmentId?: string,
): Promise<Array<{ id: string; fullName: string; photoUrl: string | null }>> {
  const qs = new URLSearchParams();
  if (assignmentId) qs.set("assignmentId", String(assignmentId));
  const query = qs.toString();
  const path = `/api/v1/schedules/available-volunteers${query ? `?${query}` : ""}`;
  const res = await api.get<unknown>(path);
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item: any) => ({
    id: String(item?.id ?? ""),
    fullName: String(item?.fullName ?? item?.name ?? ""),
    photoUrl: item?.photoUrl ?? null,
  }));
}

export async function listVolunteerAvailability(): Promise<VolunteerAvailabilityBlock[]> {
  const res = await api.get<unknown>("/api/v1/volunteer/availability-blocks");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => VolunteerAvailabilityBlockSchema.parse(item));
}

export async function createVolunteerAvailability(input: {
  startDate: Date | string;
  endDate?: Date | string | null;
  reason: string;
  note?: string | null;
}): Promise<VolunteerAvailabilityBlock> {
  const res = await api.post<unknown>("/api/v1/volunteer/availability-blocks", input);
  return VolunteerAvailabilityBlockSchema.parse(res);
}

export async function updateVolunteerAvailability(
  id: string,
  input: {
    startDate?: Date | string;
    endDate?: Date | string | null;
    reason?: string;
    note?: string | null;
  },
): Promise<VolunteerAvailabilityBlock> {
  const res = await api.patch<unknown>(`/api/v1/volunteer/availability-blocks/${id}`, input);
  return VolunteerAvailabilityBlockSchema.parse(res);
}

export async function deleteVolunteerAvailability(id: string): Promise<void> {
  await api.delete(`/api/v1/volunteer/availability-blocks/${id}`);
}
