import { api } from "@/services/api/client";
import {
  DiscipleshipSchema,
  DiscipleshipMeetingSchema,
  DiscipleshipNetworkNodeSchema,
  type Discipleship,
  type DiscipleshipMeeting,
  type DiscipleshipNetworkNode,
} from "@/types";

type MyResponseShape = {
  discipulator?: (Record<string, unknown> & {
    id: string;
    startedAt?: unknown;
    status?: unknown;
    level?: unknown;
    meetingsDone?: unknown;
    progress?: unknown;
    nextMeetingAt?: unknown;
    disciplerLastMeeting?: unknown;
    disciplerNextMeeting?: unknown;
    discipler: { id: string; fullName: string; photoUrl?: string | null };
  }) | null;
  myDisciples?: Array<
    Record<string, unknown> & {
      disciple: { id: string; fullName: string; photoUrl?: string | null };
      meetingsDone?: unknown;
      progress?: unknown;
      nextMeetingAt?: unknown;
    }
  >;
  disciplerNextMeeting?: unknown;
  disciplerLastMeeting?: unknown;
};

function mapDiscipleshipFromDiscipulator(
  raw: NonNullable<MyResponseShape["discipulator"]>,
  memberId: string,
): Discipleship {
  return {
    id: raw.id,
    discipleId: memberId,
    discipleName: "Eu",
    disciplerId: raw.discipler.id,
    disciplerName: raw.discipler.fullName,
    stage:
      raw.level !== undefined && raw.level !== null
        ? String(raw.level)
        : null,
    startDate:
      raw.startedAt !== undefined && raw.startedAt !== null
        ? new Date(String(raw.startedAt))
        : null,
    lastMeetingAt:
      raw !== undefined &&
      (raw as Record<string, unknown>).disciplerLastMeeting !== undefined &&
      (raw as Record<string, unknown>).disciplerLastMeeting !== null
        ? new Date(String((raw as Record<string, unknown>).disciplerLastMeeting))
        : null,
    nextMeetingAt:
      raw.nextMeetingAt !== undefined && raw.nextMeetingAt !== null
        ? new Date(String(raw.nextMeetingAt))
        : (raw as Record<string, unknown>).disciplerNextMeeting !== undefined &&
            (raw as Record<string, unknown>).disciplerNextMeeting !== null
          ? new Date(String((raw as Record<string, unknown>).disciplerNextMeeting))
          : null,
  };
}

function mapDiscipleshipFromDisciple(
  raw: NonNullable<MyResponseShape["myDisciples"]>[number],
  disciplerId: string,
  disciplerName: string,
): Discipleship {
  return {
    id: `disc-${raw.disciple.id}`,
    discipleId: raw.disciple.id,
    discipleName: raw.disciple.fullName,
    disciplerId,
    disciplerName,
    stage:
      raw.progress !== undefined && raw.progress !== null
        ? String(raw.progress)
        : null,
    startDate: null,
    lastMeetingAt: null,
    nextMeetingAt:
      raw.nextMeetingAt !== undefined && raw.nextMeetingAt !== null
        ? new Date(String(raw.nextMeetingAt))
        : null,
  };
}

export async function listMyDiscipleships(): Promise<Discipleship[]> {
  return getMy();
}

export async function listMyDiscipleshipNetwork(): Promise<DiscipleshipNetworkNode[]> {
  return getMyNetwork();
}

type CreateDiscipleshipMeetingInput =
  | {
      discipleshipId: string;
      meetingAt: Date | string;
      theme: string;
      notes?: string | null;
      nextMeetingAt?: Date | string | null;
      status: "SCHEDULED" | "COMPLETED" | "MISSED";
    }
  | {
      discipleshipId: string;
      date: Date | string;
      theme: string | null;
      notes?: string | null;
      nextTheme?: string | null;
      nextDate?: Date | string | null;
      status: string | null;
    };

function normalizeStatus(s: string | null | undefined): "SCHEDULED" | "COMPLETED" | "MISSED" {
  const up = String(s ?? "").toUpperCase();
  if (up === "COMPLETED" || up === "REALIZADO" || up === "FEITO") return "COMPLETED";
  if (up === "MISSED" || up === "AUSENTE" || up === "FALTOU") return "MISSED";
  return "SCHEDULED";
}

export async function createDiscipleshipMeeting(
  data: CreateDiscipleshipMeetingInput,
): Promise<{ ok: boolean; meeting: DiscipleshipMeeting | null }> {
  if ("meetingAt" in data) {
    return postMeeting({
      discipleshipId: data.discipleshipId,
      meetingAt: data.meetingAt,
      theme: data.theme,
      notes: data.notes ?? undefined,
      nextMeetingAt: data.nextMeetingAt ?? undefined,
      status: data.status,
    });
  }
  const status = normalizeStatus(data.status);
  const theme = data.theme ?? "";
  const body: Record<string, unknown> = {
    discipleshipId: data.discipleshipId,
    meetingAt: data.date,
    theme,
    status,
  };
  if (data.notes != null) body.notes = data.notes;
  if (data.nextDate != null) body.nextMeetingAt = data.nextDate;
  if (data.nextTheme != null) body.nextTheme = data.nextTheme;

  const res = await api.post<{
    ok?: boolean;
    meeting?: Record<string, unknown> | null;
  } | unknown>("/api/v1/discipleship/meetings", body);

  const obj = (res ?? {}) as {
    ok?: boolean;
    meeting?: Record<string, unknown> | null;
  };

  let meeting: DiscipleshipMeeting | null = null;
  if (obj.meeting && typeof obj.meeting === "object") {
    const raw = obj.meeting;
    try {
      meeting = DiscipleshipMeetingSchema.parse({
        id: String(raw.id ?? ""),
        discipleshipId: String(raw.discipleshipId ?? ""),
        date: new Date(String(raw.meetingAt ?? raw.date ?? new Date())),
        theme: raw.theme !== undefined && raw.theme !== null ? String(raw.theme) : null,
        notes: raw.notes !== undefined && raw.notes !== null ? String(raw.notes) : null,
        nextTheme: raw.nextTheme !== undefined && raw.nextTheme !== null ? String(raw.nextTheme) : null,
        nextDate: raw.nextMeetingAt !== undefined && raw.nextMeetingAt !== null ? new Date(String(raw.nextMeetingAt)) : null,
        status: raw.status !== undefined && raw.status !== null ? String(raw.status) : null,
      });
    } catch {
      meeting = null;
    }
  }

  return {
    ok: obj.ok === true,
    meeting,
  };
}

export async function getMy(): Promise<Discipleship[]> {
  const res = await api.get<MyResponseShape | unknown>("/api/v1/discipleship/my");
  const obj = (res ?? {}) as MyResponseShape;
  const result: Discipleship[] = [];

  if (obj.discipulator) {
    try {
      const parsed = mapDiscipleshipFromDiscipulator(
        obj.discipulator,
        obj.discipulator.discipler.id,
      );
      result.push(DiscipleshipSchema.parse(parsed));
    } catch {
      // ignora entrada inválida
    }
  }

  if (Array.isArray(obj.myDisciples)) {
    for (const d of obj.myDisciples) {
      try {
        const parsed = mapDiscipleshipFromDisciple(
          d,
          "me",
          "Eu",
        );
        result.push(DiscipleshipSchema.parse(parsed));
      } catch {
        // ignora entrada inválida
      }
    }
  }

  return result;
}

export async function getMeetings(
  discipleshipId?: string,
): Promise<DiscipleshipMeeting[]> {
  const query = discipleshipId ? `?discipleshipId=${discipleshipId}` : "";
  const res = await api.get<unknown>(`/api/v1/discipleship/meetings${query}`);
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => {
    const raw = item as Record<string, unknown>;
    return DiscipleshipMeetingSchema.parse({
      id: String(raw.id ?? ""),
      discipleshipId: String(raw.discipleshipId ?? ""),
      date: new Date(String(raw.meetingAt ?? raw.date ?? new Date())),
      theme:
        raw.theme !== undefined && raw.theme !== null
          ? String(raw.theme)
          : null,
      notes:
        raw.notes !== undefined && raw.notes !== null
          ? String(raw.notes)
          : null,
      nextTheme: null,
      nextDate:
        raw.nextMeetingAt !== undefined && raw.nextMeetingAt !== null
          ? new Date(String(raw.nextMeetingAt))
          : null,
      status:
        raw.status !== undefined && raw.status !== null
          ? String(raw.status)
          : null,
    });
  });
}

type PostMeetingInput = {
  discipleshipId: string;
  meetingAt: Date | string;
  theme: string;
  notes?: string;
  nextMeetingAt?: Date | string;
  status: "SCHEDULED" | "COMPLETED" | "MISSED";
};

export async function postMeeting(
  data: PostMeetingInput,
): Promise<{ ok: boolean; meeting: DiscipleshipMeeting | null }> {
  const body: Record<string, unknown> = {
    discipleshipId: data.discipleshipId,
    meetingAt: data.meetingAt,
    theme: data.theme,
    status: data.status,
  };
  if (data.notes !== undefined) body.notes = data.notes;
  if (data.nextMeetingAt !== undefined) body.nextMeetingAt = data.nextMeetingAt;

  const res = await api.post<{
    ok?: boolean;
    meeting?: Record<string, unknown> | null;
  } | unknown>("/api/v1/discipleship/meetings", body);

  const obj = (res ?? {}) as {
    ok?: boolean;
    meeting?: Record<string, unknown> | null;
  };

  let meeting: DiscipleshipMeeting | null = null;
  if (obj.meeting && typeof obj.meeting === "object") {
    const raw = obj.meeting;
    try {
      meeting = DiscipleshipMeetingSchema.parse({
        id: String(raw.id ?? ""),
        discipleshipId: String(raw.discipleshipId ?? ""),
        date: new Date(String(raw.meetingAt ?? raw.date ?? new Date())),
        theme:
          raw.theme !== undefined && raw.theme !== null
            ? String(raw.theme)
            : null,
        notes:
          raw.notes !== undefined && raw.notes !== null
            ? String(raw.notes)
            : null,
        nextTheme: null,
        nextDate:
          raw.nextMeetingAt !== undefined && raw.nextMeetingAt !== null
            ? new Date(String(raw.nextMeetingAt))
            : null,
        status:
          raw.status !== undefined && raw.status !== null
            ? String(raw.status)
            : null,
      });
    } catch {
      meeting = null;
    }
  }

  return {
    ok: obj.ok === true,
    meeting,
  };
}

function mapNetworkNode(raw: unknown): DiscipleshipNetworkNode {
  const obj = raw as Record<string, unknown>;
  const childrenRaw = Array.isArray(obj.children) ? obj.children : [];
  return {
    memberId: String(obj.memberId ?? obj.id ?? ""),
    name: String(obj.name ?? obj.fullName ?? ""),
    photoUrl:
      obj.photoUrl !== undefined && obj.photoUrl !== null
        ? String(obj.photoUrl)
        : obj.photo !== undefined && obj.photo !== null
          ? String(obj.photo)
          : null,
    stage:
      obj.stage !== undefined && obj.stage !== null
        ? String(obj.stage)
        : obj.level !== undefined && obj.level !== null
          ? String(obj.level)
          : null,
    disciples: childrenRaw.map((c) => mapNetworkNode(c)),
  };
}

export async function getMyNetwork(): Promise<
  DiscipleshipNetworkNode[]
> {
  const res = await api.get<{ root?: unknown } | unknown>(
    "/api/v1/discipleship/my-network",
  );
  const obj = (res ?? {}) as { root?: unknown };
  if (!obj.root) return [];
  try {
    const parsed = DiscipleshipNetworkNodeSchema.parse(
      mapNetworkNode(obj.root),
    );
    return [parsed];
  } catch {
    return [];
  }
}
