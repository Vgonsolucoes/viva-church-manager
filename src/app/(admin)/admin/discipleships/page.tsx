import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { Prisma } from "@/generated/prisma/client";
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarClock,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Eye,
  GitBranchPlus,
  History,
  NotebookPen,
  Settings,
  TrendingUp,
  Users,
  UserRoundPlus,
  Waypoints,
} from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/cn";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { hasPermission } from "@/server/rbac";
import { prisma } from "@/server/db";
import { DiscipleshipsListControls } from "./DiscipleshipsListControls";
import { EndDiscipleshipDialog } from "./EndDiscipleshipDialog";

export const dynamic = "force-dynamic";

const discipleshipStatuses = ["ACTIVE", "PAUSED", "FINISHED", "TRANSFERRED"] as const;
const meetingStatuses = ["SCHEDULED", "COMPLETED", "MISSED"] as const;
const createSchema = z.object({
  discipleId: z.string().min(1),
  disciplerId: z.string().min(1),
  startedAt: z.string().min(1),
  nextMeetingAt: z.string().optional().or(z.literal("")),
  progress: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(discipleshipStatuses),
  progress: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const meetingSchema = z.object({
  discipleshipId: z.string().min(1),
  meetingAt: z.string().min(1),
  theme: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  nextMeetingAt: z.string().optional().or(z.literal("")),
  status: z.enum(meetingStatuses),
  progress: z.string().optional().or(z.literal("")),
});

const transferSchema = z.object({
  discipleshipId: z.string().min(1),
  newDisciplerId: z.string().min(1),
  note: z.string().optional().or(z.literal("")),
  nextMeetingAt: z.string().optional().or(z.literal("")),
});

const endSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  note: z.string().optional().or(z.literal("")),
});

const statusLabels: Record<(typeof discipleshipStatuses)[number], string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  FINISHED: "Concluído",
  TRANSFERRED: "Transferido",
};

const meetingStatusLabels: Record<(typeof meetingStatuses)[number], string> = {
  SCHEDULED: "Agendado",
  COMPLETED: "Concluído",
  MISSED: "Não realizado",
};

const historyActionLabels = {
  CREATED: "Cadastro criado",
  STATUS_CHANGED: "Status alterado",
  MEETING_RECORDED: "Encontro registrado",
  TRANSFERRED: "Transferência realizada",
  PROGRESS_UPDATED: "Progresso atualizado",
} as const;

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;
type PageView = "overview" | "meetings" | "reports" | "settings";

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toOptionalDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function formatDate(value?: Date | string | null, includeTime = false) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function clampProgress(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseProgress(raw?: string) {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) return null;
  return clampProgress(parsed);
}

async function wouldCreateCycle(
  tx: Prisma.TransactionClient,
  discipleId: string,
  disciplerId: string,
) {
  let current = disciplerId;
  const visited = new Set<string>();

  while (current) {
    if (current === discipleId) return true;
    if (visited.has(current)) return true;
    visited.add(current);

    const parent = await tx.discipleship.findFirst({
      where: { discipleId: current, status: "ACTIVE" },
      select: { disciplerId: true },
    });
    if (!parent) return false;
    current = parent.disciplerId;
  }

  return false;
}

async function getNextLevel(tx: Prisma.TransactionClient, disciplerId: string) {
  const currentRelationship = await tx.discipleship.findFirst({
    where: { discipleId: disciplerId, status: "ACTIVE" },
    select: { level: true },
  });

  return currentRelationship ? currentRelationship.level + 1 : 1;
}

async function createHistoryEntry(
  tx: Prisma.TransactionClient,
  params: {
    discipleshipId?: string | null;
    memberId: string;
    action: keyof typeof historyActionLabels;
    previousDisciplerId?: string | null;
    newDisciplerId?: string | null;
    note?: string | null;
    createdById?: string | null;
  },
) {
  return tx.discipleshipHistory.create({
    data: {
      discipleshipId: params.discipleshipId ?? null,
      memberId: params.memberId,
      action: params.action,
      previousDisciplerId: params.previousDisciplerId ?? null,
      newDisciplerId: params.newDisciplerId ?? null,
      note: params.note?.trim() || null,
      createdById: params.createdById ?? null,
    },
  });
}

async function createDiscipleship(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "discipleships:write")) return;
  const parsed = createSchema.safeParse({
    discipleId: formData.get("discipleId"),
    disciplerId: formData.get("disciplerId"),
    startedAt: formData.get("startedAt"),
    nextMeetingAt: formData.get("nextMeetingAt"),
    progress: formData.get("progress"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return;
  if (parsed.data.discipleId === parsed.data.disciplerId) return;

  const progress = parseProgress(parsed.data.progress) ?? 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.discipleship.findFirst({
        where: { discipleId: parsed.data.discipleId, status: "ACTIVE" },
        select: { id: true },
      });
      if (existingActive) throw new Error("Discípulo já possui discipulador ativo.");
      if (await wouldCreateCycle(tx, parsed.data.discipleId, parsed.data.disciplerId)) {
        throw new Error("A ligação criaria um ciclo na rede.");
      }

      const level = await getNextLevel(tx, parsed.data.disciplerId);
      const row = await tx.discipleship.create({
        data: {
          discipleId: parsed.data.discipleId,
          disciplerId: parsed.data.disciplerId,
          startedAt: new Date(parsed.data.startedAt),
          nextMeetingAt: toOptionalDate(parsed.data.nextMeetingAt),
          progress,
          notes: parsed.data.notes?.trim() || null,
          status: "ACTIVE",
          level,
        },
      });

      await createHistoryEntry(tx, {
        discipleshipId: row.id,
        memberId: row.discipleId,
        action: "CREATED",
        previousDisciplerId: null,
        newDisciplerId: row.disciplerId,
        note: parsed.data.notes?.trim() || null,
        createdById: session?.uid ?? null,
      });

      return row;
    });

    await logAudit({
      actorUserId: session?.uid ?? null,
      action: "CREATE",
      entityType: "Discipleship",
      entityId: result.id,
      after: {
        id: result.id,
        discipleId: result.discipleId,
        disciplerId: result.disciplerId,
        level: result.level,
        progress: result.progress,
      },
    });
  } catch {
    return;
  }

  revalidatePath("/admin/discipleships");
}

async function updateStatus(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "discipleships:write")) return;
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    progress: formData.get("progress"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return;

  const progress = parseProgress(parsed.data.progress);
  const before = await prisma.discipleship.findUnique({ where: { id: parsed.data.id } });
  if (!before) return;

  if (
    parsed.data.status === "ACTIVE" &&
    before.status !== "ACTIVE"
  ) {
    const existingActive = await prisma.discipleship.findFirst({
      where: {
        discipleId: before.discipleId,
        status: "ACTIVE",
        id: { not: before.id },
      },
      select: { id: true },
    });
    if (existingActive) return;
  }

  const after = await prisma.discipleship.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      progress: progress ?? before.progress,
      notes: parsed.data.notes?.trim() || before.notes,
      concludedAt:
        parsed.data.status === "FINISHED" || parsed.data.status === "TRANSFERRED"
          ? new Date()
          : null,
    },
  });

  await prisma.$transaction(async (tx) => {
    await createHistoryEntry(tx, {
      discipleshipId: after.id,
      memberId: after.discipleId,
      action: "STATUS_CHANGED",
      previousDisciplerId: before.disciplerId,
      newDisciplerId: after.disciplerId,
      note: `Status alterado para ${statusLabels[after.status]}. ${parsed.data.notes?.trim() ?? ""}`.trim(),
      createdById: session?.uid ?? null,
    });

    if ((progress ?? before.progress) !== before.progress) {
      await createHistoryEntry(tx, {
        discipleshipId: after.id,
        memberId: after.discipleId,
        action: "PROGRESS_UPDATED",
        previousDisciplerId: before.disciplerId,
        newDisciplerId: after.disciplerId,
        note: `Progresso ajustado para ${after.progress}%.`,
        createdById: session?.uid ?? null,
      });
    }
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "UPDATE_STATUS",
    entityType: "Discipleship",
    entityId: after.id,
    before: { status: before.status, progress: before.progress },
    after: { status: after.status, progress: after.progress },
  });

  revalidatePath("/admin/discipleships");
}

async function registerMeeting(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "discipleships:write")) return;
  const parsed = meetingSchema.safeParse({
    discipleshipId: formData.get("discipleshipId"),
    meetingAt: formData.get("meetingAt"),
    theme: formData.get("theme"),
    notes: formData.get("notes"),
    nextMeetingAt: formData.get("nextMeetingAt"),
    status: formData.get("status"),
    progress: formData.get("progress"),
  });
  if (!parsed.success) return;

  const before = await prisma.discipleship.findUnique({ where: { id: parsed.data.discipleshipId } });
  if (!before) return;

  const progress = parseProgress(parsed.data.progress) ?? before.progress;

  const result = await prisma.$transaction(async (tx) => {
    const meeting = await tx.discipleshipMeeting.create({
      data: {
        discipleshipId: before.id,
        meetingAt: new Date(parsed.data.meetingAt),
        theme: parsed.data.theme?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        nextMeetingAt: toOptionalDate(parsed.data.nextMeetingAt),
        status: parsed.data.status,
        createdById: session?.uid ?? null,
      },
    });

    const after = await tx.discipleship.update({
      where: { id: before.id },
      data: {
        meetingsDone:
          parsed.data.status === "COMPLETED"
            ? { increment: 1 }
            : undefined,
        nextMeetingAt: toOptionalDate(parsed.data.nextMeetingAt),
        progress,
      },
    });

    await createHistoryEntry(tx, {
      discipleshipId: after.id,
      memberId: after.discipleId,
      action: "MEETING_RECORDED",
      previousDisciplerId: after.disciplerId,
      newDisciplerId: after.disciplerId,
      note: `${meetingStatusLabels[parsed.data.status]}: ${parsed.data.theme?.trim() || "Encontro de discipulado"}`,
      createdById: session?.uid ?? null,
    });

    if (after.progress !== before.progress) {
      await createHistoryEntry(tx, {
        discipleshipId: after.id,
        memberId: after.discipleId,
        action: "PROGRESS_UPDATED",
        previousDisciplerId: after.disciplerId,
        newDisciplerId: after.disciplerId,
        note: `Progresso atualizado para ${after.progress}% após encontro.`,
        createdById: session?.uid ?? null,
      });
    }

    return { meeting, after };
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "MEETING_DONE",
    entityType: "DiscipleshipMeeting",
    entityId: result.meeting.id,
    before: { meetingsDone: before.meetingsDone, progress: before.progress },
    after: { meetingsDone: result.after.meetingsDone, progress: result.after.progress },
  });

  revalidatePath("/admin/discipleships");
}

async function transferDisciple(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "discipleships:write")) return;
  const parsed = transferSchema.safeParse({
    discipleshipId: formData.get("discipleshipId"),
    newDisciplerId: formData.get("newDisciplerId"),
    note: formData.get("note"),
    nextMeetingAt: formData.get("nextMeetingAt"),
  });
  if (!parsed.success) return;

  const current = await prisma.discipleship.findUnique({ where: { id: parsed.data.discipleshipId } });
  if (!current || current.status !== "ACTIVE") return;
  if (current.disciplerId === parsed.data.newDisciplerId) return;

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (await wouldCreateCycle(tx, current.discipleId, parsed.data.newDisciplerId)) {
        throw new Error("A transferência criaria um ciclo.");
      }

      const level = await getNextLevel(tx, parsed.data.newDisciplerId);

      const transferred = await tx.discipleship.update({
        where: { id: current.id },
        data: {
          status: "TRANSFERRED",
          concludedAt: new Date(),
          nextMeetingAt: null,
        },
      });

      const next = await tx.discipleship.create({
        data: {
          discipleId: current.discipleId,
          disciplerId: parsed.data.newDisciplerId,
          startedAt: new Date(),
          nextMeetingAt: toOptionalDate(parsed.data.nextMeetingAt),
          progress: current.progress,
          notes: parsed.data.note?.trim() || current.notes,
          status: "ACTIVE",
          level,
        },
      });

      await createHistoryEntry(tx, {
        discipleshipId: transferred.id,
        memberId: current.discipleId,
        action: "TRANSFERRED",
        previousDisciplerId: current.disciplerId,
        newDisciplerId: parsed.data.newDisciplerId,
        note: parsed.data.note?.trim() || "Transferência registrada.",
        createdById: session?.uid ?? null,
      });

      await createHistoryEntry(tx, {
        discipleshipId: next.id,
        memberId: current.discipleId,
        action: "CREATED",
        previousDisciplerId: current.disciplerId,
        newDisciplerId: parsed.data.newDisciplerId,
        note: "Novo discipulador vinculado após transferência.",
        createdById: session?.uid ?? null,
      });

      return { transferred, next };
    });

    await logAudit({
      actorUserId: session?.uid ?? null,
      action: "TRANSFER",
      entityType: "Discipleship",
      entityId: result.next.id,
      before: { disciplerId: current.disciplerId, status: current.status },
      after: { disciplerId: result.next.disciplerId, status: result.next.status },
    });
  } catch {
    return;
  }

  revalidatePath("/admin/discipleships");
}

async function endDiscipleship(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "discipleships:write")) return;
  const parsed = endSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
    note: formData.get("note"),
  });
  if (!parsed.success) return;

  const before = await prisma.discipleship.findUnique({ where: { id: parsed.data.id } });
  if (!before) return;
  if (before.status !== "ACTIVE" && before.status !== "PAUSED") return;

  const reason = parsed.data.reason.trim();
  const extraNote = parsed.data.note?.trim() ?? "";
  const historyNote = `Vínculo encerrado via Excluir Vínculo. Motivo: ${reason}.${extraNote ? ` Observação: ${extraNote}` : ""}`;

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.discipleship.update({
      where: { id: before.id },
      data: {
        status: "FINISHED",
        concludedAt: new Date(),
        nextMeetingAt: null,
        notes: extraNote ? `${reason} — ${extraNote}` : reason,
      },
    });

    await createHistoryEntry(tx, {
      discipleshipId: updated.id,
      memberId: updated.discipleId,
      action: "STATUS_CHANGED",
      previousDisciplerId: updated.disciplerId,
      newDisciplerId: updated.disciplerId,
      note: historyNote,
      createdById: session.uid ?? null,
    });

    return updated;
  });

  await logAudit({
    actorUserId: session.uid ?? null,
    action: "END",
    entityType: "Discipleship",
    entityId: after.id,
    before: { status: before.status, disciplerId: before.disciplerId },
    after: { status: after.status, concludedAt: after.concludedAt, reason },
  });

  revalidatePath("/admin/discipleships");
}

function getDescendantCounter(activeRows: Array<{ disciplerId: string; discipleId: string }>) {
  const childrenMap = new Map<string, string[]>();
  for (const row of activeRows) {
    childrenMap.set(row.disciplerId, [...(childrenMap.get(row.disciplerId) ?? []), row.discipleId]);
  }

  const cache = new Map<string, number>();
  const visit = (memberId: string): number => {
    if (cache.has(memberId)) return cache.get(memberId) ?? 0;
    const children = childrenMap.get(memberId) ?? [];
    const total = children.length + children.reduce((sum, childId) => sum + visit(childId), 0);
    cache.set(memberId, total);
    return total;
  };

  return { count: visit };
}

export default async function DiscipleshipsPage(props: { searchParams?: SearchParamsInput }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "discipleships:read")) {
    redirect("/admin");
  }
  const canWrite = hasPermission(session.roles ?? [], "discipleships:write");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const viewParam = getSearchValue(searchParams?.view);
  if (viewParam === "network") redirect("/admin/discipleships/network");
  const view: PageView =
    viewParam === "meetings" ||
    viewParam === "reports" ||
    viewParam === "settings"
      ? viewParam
      : "overview";
  const preselectedDisciplerId = getSearchValue(searchParams?.discipler) ?? "";
  const selectedMemberId = getSearchValue(searchParams?.member) ?? "";

  const q = (getSearchValue(searchParams?.q) ?? "").trim();
  const statusParam = getSearchValue(searchParams?.status) ?? "active";
  const listStatus: "active" | "paused" | "ended" | "all" =
    statusParam === "paused" || statusParam === "ended" || statusParam === "all"
      ? statusParam
      : "active";
  const disciplerFilter = (getSearchValue(searchParams?.discipulador) ?? "").trim();
  const takeRaw = Number.parseInt(getSearchValue(searchParams?.take) || "20", 10);
  const take = [10, 20, 50].includes(takeRaw) ? takeRaw : 20;
  const requestedPage = Math.max(
    1,
    Number.parseInt(getSearchValue(searchParams?.page) || "1", 10) || 1,
  );
  const selectedBondId = (getSearchValue(searchParams?.vinculo) ?? "").trim();

  const memberRelationSelect = {
    id: true,
    fullName: true,
    photoUrl: true,
    phone: true,
    email: true,
    type: true,
  } as const;

  const searchOr: Prisma.DiscipleshipWhereInput[] = q
    ? (["disciple", "discipler"] as const).flatMap((rel) => {
        const filters: Prisma.DiscipleshipWhereInput[] = [
          { [rel]: { fullName: { contains: q, mode: "insensitive" } } },
          { [rel]: { email: { contains: q, mode: "insensitive" } } },
          { [rel]: { phone: { contains: q, mode: "insensitive" } } },
        ];
        const digits = q.replace(/\D/g, "");
        if (digits && digits !== q) {
          filters.push({ [rel]: { phone: { contains: digits } } });
        }
        return filters;
      })
    : [];

  const listWhere: Prisma.DiscipleshipWhereInput = {
    AND: [
      listStatus === "active"
        ? { status: "ACTIVE" }
        : listStatus === "paused"
          ? { status: "PAUSED" }
          : listStatus === "ended"
            ? { status: { in: ["FINISHED", "TRANSFERRED"] } }
            : {},
      disciplerFilter ? { disciplerId: disciplerFilter } : {},
      ...(searchOr.length ? [{ OR: searchOr }] : []),
    ],
  };

  const [
    members,
    rows,
    meetings,
    activeGraphRows,
    totalFiltered,
    totalActive,
    totalPaused,
    totalFinished,
    activeDisciplerIds,
  ] = await Promise.all([
    prisma.member.findMany({
      orderBy: { fullName: "asc" },
      take: 500,
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        phone: true,
        email: true,
        type: true,
        types: true,
        joinedAt: true,
      },
    }),
    prisma.discipleship.findMany({
      orderBy: { updatedAt: "desc" },
      take: 250,
      include: {
        disciple: { select: memberRelationSelect },
        discipler: { select: memberRelationSelect },
      },
    }),
    prisma.discipleshipMeeting.findMany({
      orderBy: { meetingAt: "desc" },
      take: 200,
      include: {
        discipleship: {
          include: {
            disciple: {
              select: { id: true, fullName: true },
            },
            discipler: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
    }),
    prisma.discipleship.findMany({
      where: { status: "ACTIVE" },
      select: { disciplerId: true, discipleId: true },
    }),
    prisma.discipleship.count({ where: listWhere }),
    prisma.discipleship.count({ where: { status: "ACTIVE" } }),
    prisma.discipleship.count({ where: { status: "PAUSED" } }),
    prisma.discipleship.count({ where: { status: "FINISHED" } }),
    prisma.discipleship.findMany({
      where: { status: "ACTIVE" },
      select: { disciplerId: true },
      distinct: ["disciplerId"],
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / take));
  const page = Math.min(requestedPage, totalPages);

  const listRows = await prisma.discipleship.findMany({
    where: listWhere,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * take,
    take,
    include: {
      disciple: { select: memberRelationSelect },
      discipler: { select: memberRelationSelect },
    },
  });

  const detailRow = selectedBondId
    ? await prisma.discipleship.findUnique({
        where: { id: selectedBondId },
        include: {
          disciple: { select: memberRelationSelect },
          discipler: { select: memberRelationSelect },
        },
      })
    : null;

  const detailMeetings = detailRow
    ? await prisma.discipleshipMeeting.findMany({
        where: { discipleshipId: detailRow.id },
        orderBy: { meetingAt: "desc" },
        take: 10,
      })
    : [];

  const detailHistory = detailRow
    ? await prisma.discipleshipHistory.findMany({
        where: { discipleshipId: detailRow.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          previousDiscipler: { select: { id: true, fullName: true } },
          newDiscipler: { select: { id: true, fullName: true } },
        },
      })
    : [];

  const disciplerOptions = Array.from(
    new Map(rows.map((row) => [row.disciplerId, row.discipler.fullName])).entries(),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const buildListHref = (overrides: Record<string, string | null> = {}) => {
    const params = new URLSearchParams();
    params.set("view", "overview");
    if (q) params.set("q", q);
    if (listStatus !== "active") params.set("status", listStatus);
    if (disciplerFilter) params.set("discipulador", disciplerFilter);
    if (take !== 20) params.set("take", String(take));
    if (page > 1) params.set("page", String(page));
    if (selectedBondId) params.set("vinculo", selectedBondId);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    return `/admin/discipleships?${qs}`;
  };

  const activeRows = rows.filter((row) => row.status === "ACTIVE");
  const pausedRows = rows.filter((row) => row.status === "PAUSED");
  const finishedRows = rows.filter((row) => row.status === "FINISHED");
  const transferredRows = rows.filter((row) => row.status === "TRANSFERRED");

  const activeDisciplersCount = activeDisciplerIds.length;
  const averageDisciplesByDiscipler =
    activeDisciplersCount > 0 ? totalActive / activeDisciplersCount : 0;

  const { count: countDescendants } = getDescendantCounter(activeGraphRows);

  const latestReferenceTime =
    meetings[0]?.meetingAt.getTime() ??
    rows[0]?.updatedAt.getTime() ??
    rows[0]?.startedAt.getTime() ??
    0;
  const recentMeetingCutoff = latestReferenceTime - 1000 * 60 * 60 * 24 * 45;
  const staleMeetingCutoff = latestReferenceTime - 1000 * 60 * 60 * 24 * 30;

  const directCountByMember = new Map<string, number>();
  for (const row of activeGraphRows) {
    directCountByMember.set(row.disciplerId, (directCountByMember.get(row.disciplerId) ?? 0) + 1);
  }

  const latestMeetingByDiscipleship = new Map<string, (typeof meetings)[number]>();
  for (const meeting of meetings) {
    if (!latestMeetingByDiscipleship.has(meeting.discipleshipId)) {
      latestMeetingByDiscipleship.set(meeting.discipleshipId, meeting);
    }
  }

  const networksGrowing = Array.from(
    new Set(activeGraphRows.map((row) => row.disciplerId)),
  ).filter((memberId) => countDescendants(memberId) >= 2).length;

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date),
      count: rows.filter(
        (row) =>
          row.startedAt.getFullYear() === date.getFullYear() &&
          row.startedAt.getMonth() === date.getMonth(),
      ).length,
    };
  });

  const mostActiveDisciplers = Array.from(
    new Set(activeRows.map((row) => row.disciplerId)),
  )
    .map((memberId) => {
      const member = members.find((item) => item.id === memberId);
      const direct = directCountByMember.get(memberId) ?? 0;
      const total = countDescendants(memberId);
      const recentMeetings = meetings.filter(
        (meeting) =>
          meeting.discipleship.discipler.id === memberId &&
          meeting.createdAt.getTime() >= recentMeetingCutoff,
      ).length;
      return {
        memberId,
        name: member?.fullName ?? "Membro",
        direct,
        total,
        recentMeetings,
      };
    })
    .sort((a, b) => b.direct + b.recentMeetings - (a.direct + a.recentMeetings))
    .slice(0, 6);

  const disciplesWithoutRecentMeeting = activeRows
    .map((row) => ({
      row,
      latestMeeting: latestMeetingByDiscipleship.get(row.id),
    }))
    .filter(({ latestMeeting }) => {
      if (!latestMeeting) return true;
      return latestMeeting.meetingAt.getTime() < staleMeetingCutoff;
    })
    .slice(0, 10);

  const levelReport = Array.from(
    new Map(
      activeRows.map((row) => [
        row.level,
        activeRows.filter((candidate) => candidate.level === row.level).length,
      ]),
    ).entries(),
  )
    .sort((a, b) => a[0] - b[0])
    .map(([level, total]) => ({ level, total }));

  const rootNetworks = Array.from(
    new Set(
      activeRows
        .filter((row) => !activeRows.some((candidate) => candidate.discipleId === row.disciplerId))
        .map((row) => row.disciplerId),
    ),
  )
    .map((memberId) => ({
      memberId,
      name: members.find((member) => member.id === memberId)?.fullName ?? "Membro",
      totalDescendants: countDescendants(memberId),
      directDescendants: directCountByMember.get(memberId) ?? 0,
    }))
    .sort((a, b) => b.totalDescendants - a.totalDescendants);

  const transferCandidates = activeRows.filter((row) =>
    selectedMemberId ? row.discipleId === selectedMemberId : true,
  );
  const defaultTransferRelationshipId = transferCandidates[0]?.id ?? activeRows[0]?.id ?? "";

  const internalMenu = [
    { key: "overview", label: "Visão Geral", icon: <Waypoints className="size-4" />, href: "/admin/discipleships?view=overview" },
    { key: "network", label: "Rede de Discipulado", icon: <GitBranchPlus className="size-4" />, href: "/admin/discipleships/network" },
    { key: "meetings", label: "Encontros", icon: <CalendarClock className="size-4" />, href: "/admin/discipleships?view=meetings" },
    { key: "reports", label: "Relatórios", icon: <ChartColumn className="size-4" />, href: "/admin/discipleships?view=reports" },
    { key: "settings", label: "Configurações", icon: <Settings className="size-4" />, href: "/admin/discipleships?view=settings" },
  ] satisfies Array<{ key: string; label: string; icon: React.ReactNode; href: string }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">Discipulados</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Acompanhe a multiplicação espiritual da igreja com visão geral, rede em árvore, encontros, histórico e linhagem completa.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className="bg-[rgba(88,167,255,0.12)]">Rede premium dark</Badge>
          <Badge className="bg-[rgba(162,105,255,0.12)]">Perfil lateral</Badge>
          <Badge className="bg-[rgba(34,197,94,0.12)]">Transferência com histórico</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total de discipuladores"
          value={activeDisciplersCount}
          subtitle="Membros com discípulos ativos"
          tone="blue"
          icon={<Users className="size-5" />}
        />
        <StatCard
          title="Discípulos ativos"
          value={totalActive}
          subtitle="Vínculos ativos em andamento"
          tone="purple"
          icon={<UserRoundPlus className="size-5" />}
        />
        <StatCard
          title="Redes em crescimento"
          value={networksGrowing}
          subtitle="Discipuladores com expansão abaixo da base"
          tone="emerald"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          title="Discipulados concluídos"
          value={totalFinished}
          subtitle="Histórico preservado"
          tone="orange"
          icon={<NotebookPen className="size-5" />}
        />
        <StatCard
          title="Discipulados pausados"
          value={totalPaused}
          subtitle="Aguardam retomada"
          tone="red"
          icon={<History className="size-5" />}
        />
        <StatCard
          title="Média por discipulador"
          value={averageDisciplesByDiscipler.toFixed(1)}
          subtitle="Discípulos ativos por base"
          tone="blue"
          icon={<CircleGauge className="size-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <div className="text-sm font-semibold">Menu do módulo</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Navegue entre visão geral, rede, encontros, relatórios e configurações.
          </div>
          <div className="mt-4 space-y-2">
            {internalMenu.map((item) => {
              const active = item.key === view;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-[background,color,border-color,box-shadow]",
                    active
                      ? "border-[rgba(88,167,255,0.32)] bg-[rgba(88,167,255,0.12)] text-foreground shadow-[0_18px_70px_-46px_rgba(88,167,255,0.72)]"
                      : "border-border/70 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                  )}
                >
                  <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Regras da rede
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>Um membro pode ter apenas um discipulador ativo por vez.</div>
              <div>Um discipulador pode cuidar de vários discípulos.</div>
              <div>Conclusões e transferências mantêm histórico completo.</div>
              <div>Linhas da rede respeitam a linhagem espiritual.</div>
            </div>
          </div>
        </Card>

        <div className="min-w-0">
          {view === "overview" ? (
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_400px]">
              {detailRow ? (
                <Card className="p-5">
                  <Link
                    href={buildListHref({ vinculo: null })}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                    Voltar para Visão Geral
                  </Link>

                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {detailRow.discipler.fullName} <span className="text-muted-foreground">→</span> {detailRow.disciple.fullName}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Início {formatDate(detailRow.startedAt)} • Nível {detailRow.level} • Encontros {detailRow.meetingsDone}
                        {detailRow.concludedAt ? ` • Encerrado em ${formatDate(detailRow.concludedAt)}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{statusLabels[detailRow.status]}</Badge>
                      <Badge className="bg-muted/10">{directCountByMember.get(detailRow.discipleId) ?? 0} diretos</Badge>
                      <Badge className="bg-muted/10">
                        {Math.max(
                          countDescendants(detailRow.discipleId) -
                            (directCountByMember.get(detailRow.discipleId) ?? 0),
                          0,
                        )}{" "}
                        indiretos
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progresso do discipulado</span>
                        <span>{detailRow.progress}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted/30">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#58a7ff] via-[#2b8cff] to-[#a269ff]"
                          style={{ width: `${clampProgress(detailRow.progress)}%` }}
                        />
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Último encontro: {detailMeetings[0] ? formatDate(detailMeetings[0].meetingAt, true) : "Ainda não registrado"}
                        {detailRow.nextMeetingAt ? ` • Próximo ${formatDate(detailRow.nextMeetingAt)}` : ""}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                      <div className="text-xs text-muted-foreground">Observações</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {detailRow.notes || "Sem observações registradas para este discipulado."}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/admin/discipleships/network?member=${detailRow.discipleId}`}>
                      <Button type="button">
                        <Waypoints className="mr-2 size-4" />
                        Ver na rede
                      </Button>
                    </Link>
                    <Link href={`?view=meetings&member=${detailRow.discipleId}#discipleship-meetings`}>
                      <Button type="button" variant="secondary">
                        <CalendarClock className="mr-2 size-4" />
                        Ver histórico
                      </Button>
                    </Link>
                    {canWrite ? (
                      <Link href={`?view=overview&member=${detailRow.discipleId}#discipleship-transfer-form`}>
                        <Button type="button" variant="outline">
                          <ArrowRightLeft className="mr-2 size-4" />
                          Transferir discípulo
                        </Button>
                      </Link>
                    ) : null}
                    {canWrite && (detailRow.status === "ACTIVE" || detailRow.status === "PAUSED") ? (
                      <EndDiscipleshipDialog
                        discipleshipId={detailRow.id}
                        disciplerName={detailRow.discipler.fullName}
                        discipleName={detailRow.disciple.fullName}
                        action={endDiscipleship}
                      />
                    ) : null}
                  </div>

                  {canWrite ? (
                    <form action={updateStatus} className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-background/50 p-3">
                      <input type="hidden" name="id" value={detailRow.id} />
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <select
                          name="status"
                          defaultValue={detailRow.status}
                          className="h-11 rounded-2xl border border-border/80 bg-background px-3 text-sm"
                        >
                          <option value="ACTIVE">Ativo</option>
                          <option value="PAUSED">Pausado</option>
                          <option value="FINISHED">Concluído</option>
                          <option value="TRANSFERRED">Transferido</option>
                        </select>
                        <Input name="progress" type="number" min="0" max="100" defaultValue={detailRow.progress} placeholder="Progresso %" />
                        <Button type="submit" variant="secondary">Salvar status</Button>
                      </div>
                      <Input name="notes" defaultValue={detailRow.notes ?? ""} placeholder="Observações ou contexto pastoral" />
                    </form>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Encontros do vínculo
                      </div>
                      <div className="mt-3 space-y-2">
                        {detailMeetings.length ? (
                          detailMeetings.map((meeting) => (
                            <div key={meeting.id} className="rounded-2xl border border-border/70 bg-background/50 p-3">
                              <div className="text-sm font-semibold">{meeting.theme || "Encontro de discipulado"}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatDate(meeting.meetingAt, true)} • {meetingStatusLabels[meeting.status]}
                              </div>
                              {meeting.notes ? (
                                <div className="mt-2 text-sm text-muted-foreground">{meeting.notes}</div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">Nenhum encontro registrado neste vínculo.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Histórico do vínculo
                      </div>
                      <div className="mt-3 space-y-2">
                        {detailHistory.length ? (
                          detailHistory.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-border/70 bg-background/50 p-3">
                              <div className="text-sm font-semibold">{historyActionLabels[item.action]}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatDate(item.createdAt, true)}
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                {item.previousDiscipler || item.newDiscipler
                                  ? `${item.previousDiscipler?.fullName ?? "—"} → ${item.newDiscipler?.fullName ?? "—"}`
                                  : ""}
                                {item.note ? `${item.previousDiscipler || item.newDiscipler ? " • " : ""}${item.note}` : ""}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">Nenhum histórico registrado.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Visão geral dos discipulados</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Lista compacta com pesquisa, filtros e paginação. Abra um vínculo para ver os detalhes.
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{totalFiltered} vínculos</div>
                  </div>

                  <div className="mt-4">
                    <DiscipleshipsListControls disciplerOptions={disciplerOptions} />
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    Exibindo {totalFiltered === 0 ? 0 : (page - 1) * take + 1}–{Math.min(page * take, totalFiltered)} de {totalFiltered} vínculos
                  </div>

                  <div className="mt-3 hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-3 pr-3 font-medium">Discípulo</th>
                          <th className="py-3 pr-3 font-medium">Discipulador</th>
                          <th className="py-3 pr-3 font-medium">Status</th>
                          <th className="py-3 pr-3 font-medium">Nível</th>
                          <th className="py-3 pr-3 font-medium">Progresso</th>
                          <th className="py-3 pr-3 font-medium">Início</th>
                          <th className="py-3 pr-3 font-medium">Próximo encontro</th>
                          <th className="py-3 font-medium"><span className="sr-only">Ações</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {listRows.map((row) => (
                          <tr key={row.id} className="border-b border-border/50 last:border-0">
                            <td className="max-w-44 truncate py-3 pr-3 font-medium">{row.disciple.fullName}</td>
                            <td className="max-w-44 truncate py-3 pr-3 text-muted-foreground">{row.discipler.fullName}</td>
                            <td className="py-3 pr-3"><Badge>{statusLabels[row.status]}</Badge></td>
                            <td className="py-3 pr-3 text-muted-foreground">{row.level}</td>
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 rounded-full bg-muted/30">
                                  <div
                                    className="h-2 rounded-full bg-gradient-to-r from-[#58a7ff] to-[#a269ff]"
                                    style={{ width: `${clampProgress(row.progress)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{row.progress}%</span>
                              </div>
                            </td>
                            <td className="py-3 pr-3 text-muted-foreground">{formatDate(row.startedAt)}</td>
                            <td className="py-3 pr-3 text-muted-foreground">{row.nextMeetingAt ? formatDate(row.nextMeetingAt) : "—"}</td>
                            <td className="py-3 text-right">
                              <Link href={buildListHref({ vinculo: row.id })}>
                                <Button type="button" size="sm" variant="secondary">
                                  <Eye className="mr-1.5 size-4" />
                                  Abrir
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!listRows.length ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum vínculo encontrado com os filtros atuais.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-3 md:hidden">
                    {listRows.length ? (
                      listRows.map((row) => (
                        <div key={row.id} className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{row.disciple.fullName}</div>
                              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                Discipulador: {row.discipler.fullName}
                              </div>
                            </div>
                            <Badge>{statusLabels[row.status]}</Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Nível {row.level} • Progresso {row.progress}% • Início {formatDate(row.startedAt)}
                            {row.nextMeetingAt ? ` • Próximo ${formatDate(row.nextMeetingAt)}` : ""}
                          </div>
                          <Link href={buildListHref({ vinculo: row.id })} className="mt-3 block">
                            <Button type="button" size="sm" variant="secondary" className="w-full">
                              <Eye className="mr-1.5 size-4" />
                              Abrir
                            </Button>
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum vínculo encontrado com os filtros atuais.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    {page > 1 ? (
                      <Link href={buildListHref({ page: String(page - 1) })}>
                        <Button type="button" variant="outline" size="sm">
                          <ChevronLeft className="mr-1 size-4" />
                          Anterior
                        </Button>
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-xs text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    {page < totalPages ? (
                      <Link href={buildListHref({ page: String(page + 1) })}>
                        <Button type="button" variant="outline" size="sm">
                          Próxima
                          <ChevronRight className="ml-1 size-4" />
                        </Button>
                      </Link>
                    ) : (
                      <span />
                    )}
                  </div>
                </Card>
              )}

              {canWrite ? (
              <div className="space-y-4">
                <Card className="p-5" id="discipleship-create-form">
                  <div className="text-sm font-semibold">Novo discipulado</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Crie novos vínculos preservando a regra de um discipulador ativo por discípulo.
                  </div>
                  <form action={createDiscipleship} className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Discipulador</div>
                      <select
                        name="disciplerId"
                        className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
                        required
                        defaultValue={preselectedDisciplerId}
                      >
                        <option value="" disabled>Selecionar membro</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Discípulo</div>
                      <select
                        name="discipleId"
                        className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>Selecionar membro</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Data de início</div>
                        <Input name="startedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Próximo encontro</div>
                        <Input name="nextMeetingAt" type="date" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Progresso inicial</div>
                      <Input name="progress" type="number" min="0" max="100" placeholder="0 a 100" defaultValue="0" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Observações</div>
                      <textarea
                        name="notes"
                        className="min-h-24 w-full rounded-2xl border border-border/80 bg-background px-3 py-3 text-sm"
                        placeholder="Contexto pastoral, foco do discipulado, necessidades..."
                      />
                    </div>
                    <Button className="w-full" type="submit">
                      <GitBranchPlus className="mr-2 size-4" />
                      Criar discipulado
                    </Button>
                  </form>
                </Card>

                <Card className="p-5" id="discipleship-transfer-form">
                  <div className="text-sm font-semibold">Transferir discípulo</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Registra a transferência e mantém o histórico completo da linhagem.
                  </div>
                  <form action={transferDisciple} className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Discípulo ativo</div>
                      <select
                        name="discipleshipId"
                        className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
                        defaultValue={defaultTransferRelationshipId}
                      >
                        {transferCandidates.length ? (
                          transferCandidates.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.disciple.fullName} • atual: {row.discipler.fullName}
                            </option>
                          ))
                        ) : (
                          <option value="">Nenhum discípulo ativo disponível</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Novo discipulador</div>
                      <select
                        name="newDisciplerId"
                        className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
                        defaultValue=""
                      >
                        <option value="" disabled>Selecionar novo discipulador</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input name="nextMeetingAt" type="date" />
                    <textarea
                      name="note"
                      className="min-h-24 w-full rounded-2xl border border-border/80 bg-background px-3 py-3 text-sm"
                      placeholder="Motivo da transferência e observações pastorais"
                    />
                    <Button className="w-full" type="submit" variant="secondary">
                      <ArrowRightLeft className="mr-2 size-4" />
                      Transferir discípulo
                    </Button>
                  </form>
                </Card>
              </div>
              ) : null}
            </div>
          ) : null}

          {view === "meetings" ? (
            <div className={cn("grid grid-cols-1 gap-4", canWrite ? "xl:grid-cols-[380px_minmax(0,1fr)]" : "")}>
              {canWrite ? (
              <Card className="p-5" id="discipleship-meetings">
                <div className="text-sm font-semibold">Registrar encontro</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Atualize histórico, próxima reunião e evolução do discipulado.
                </div>
                <form action={registerMeeting} className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Discipulado</div>
                    <select
                      name="discipleshipId"
                      className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
                      defaultValue={
                        selectedMemberId
                          ? rows.find((row) => row.discipleId === selectedMemberId)?.id ?? rows[0]?.id ?? ""
                          : rows[0]?.id ?? ""
                      }
                    >
                      {rows.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.discipler.fullName} → {row.disciple.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input name="meetingAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    <Input name="nextMeetingAt" type="date" />
                  </div>
                  <Input name="theme" placeholder="Tema do encontro" />
                  <select
                    name="status"
                    className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
                    defaultValue="COMPLETED"
                  >
                    <option value="COMPLETED">Concluído</option>
                    <option value="SCHEDULED">Agendado</option>
                    <option value="MISSED">Não realizado</option>
                  </select>
                  <Input name="progress" type="number" min="0" max="100" placeholder="Progresso atualizado %" />
                  <textarea
                    name="notes"
                    className="min-h-28 w-full rounded-2xl border border-border/80 bg-background px-3 py-3 text-sm"
                    placeholder="Resumo do encontro, evolução, decisões e próximo passo"
                  />
                  <Button className="w-full" type="submit">
                    <CalendarClock className="mr-2 size-4" />
                    Registrar encontro
                  </Button>
                </form>
              </Card>
              ) : null}

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Histórico de encontros</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Temas, observações, status do encontro e próxima reunião.
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{meetings.length} registros</div>
                </div>

                <div className="mt-4 space-y-3">
                  {meetings.length ? (
                    meetings.map((meeting) => (
                      <div key={meeting.id} className="rounded-3xl border border-border/70 bg-muted/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">
                              {meeting.discipleship.discipler.fullName} → {meeting.discipleship.disciple.fullName}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDate(meeting.meetingAt, true)} • {meetingStatusLabels[meeting.status]}
                              {meeting.nextMeetingAt ? ` • Próximo ${formatDate(meeting.nextMeetingAt)}` : ""}
                            </div>
                          </div>
                          <Badge>{meetingStatusLabels[meeting.status]}</Badge>
                        </div>
                        <div className="mt-3 text-sm font-semibold">{meeting.theme || "Encontro de discipulado"}</div>
                        {meeting.notes ? (
                          <div className="mt-2 text-sm text-muted-foreground">{meeting.notes}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Nenhum encontro registrado ainda.</div>
                  )}
                </div>
              </Card>
            </div>
          ) : null}

          {view === "reports" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="p-5">
                  <div className="text-sm font-semibold">Crescimento da rede por período</div>
                  <div className="mt-4 space-y-3">
                    {months.map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.label}</span>
                          <span className="font-semibold">{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-[#58a7ff] to-[#a269ff]"
                            style={{
                              width: `${rows.length ? Math.max((item.count / rows.length) * 100, 6) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="text-sm font-semibold">Discipuladores mais ativos</div>
                  <div className="mt-4 space-y-3">
                    {mostActiveDisciplers.map((item) => (
                      <div key={item.memberId} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.direct} diretos • {item.total} totais • {item.recentMeetings} encontros recentes
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="text-sm font-semibold">Discípulos por nível</div>
                  <div className="mt-4 space-y-3">
                    {levelReport.map((item) => (
                      <div key={item.level} className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/10 px-3 py-3 text-sm">
                        <span>Nível {item.level}</span>
                        <Badge>{item.total}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="p-5">
                  <div className="text-sm font-semibold">Discípulos sem encontro recente</div>
                  <div className="mt-4 space-y-3">
                    {disciplesWithoutRecentMeeting.length ? (
                      disciplesWithoutRecentMeeting.map(({ row, latestMeeting }) => (
                        <div key={row.id} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                          <div className="text-sm font-semibold">{row.disciple.fullName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Discipulador: {row.discipler.fullName}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Último encontro: {latestMeeting ? formatDate(latestMeeting.meetingAt, true) : "Nenhum"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Todos os discípulos tiveram encontro recente.</div>
                    )}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="text-sm font-semibold">Árvore completa por discipulador</div>
                  <div className="mt-4 space-y-3">
                    {rootNetworks.length ? (
                      rootNetworks.map((network) => (
                        <div key={network.memberId} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                          <div className="text-sm font-semibold">{network.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {network.directDescendants} diretos • {network.totalDescendants} totais na árvore
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Nenhuma árvore ativa montada ainda.</div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="p-5">
                  <div className="text-sm font-semibold">Discipulados pausados</div>
                  <div className="mt-4 space-y-3">
                    {pausedRows.length ? (
                      pausedRows.map((row) => (
                        <div key={row.id} className="rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm">
                          {row.disciple.fullName} • {row.discipler.fullName}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Nenhum discipulado pausado.</div>
                    )}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="text-sm font-semibold">Discipulados concluídos e transferidos</div>
                  <div className="mt-4 space-y-3">
                    {[...finishedRows, ...transferredRows].length ? (
                      [...finishedRows, ...transferredRows].map((row) => (
                        <div key={row.id} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                          <div className="text-sm font-semibold">
                            {row.disciple.fullName} • {statusLabels[row.status]}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.discipler.fullName} • iniciado em {formatDate(row.startedAt)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Nenhum discipulado concluído ou transferido.</div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {view === "settings" ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="p-5">
                <div className="text-sm font-semibold">Configurações operacionais</div>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    Um membro pode ser discípulo ativo de apenas um discipulador por vez.
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    A transferência encerra o vínculo atual como transferido e cria um novo vínculo ativo.
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    Encontros alimentam progresso, próxima reunião e histórico da linhagem.
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    O log de auditoria e o histórico do discipulado preservam alterações críticas.
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold">Legenda visual da rede</div>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    Cores diferentes representam níveis distintos da rede de discipulado.
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    Cards mostram avatar, status, início, nível e quantidade de discípulos abaixo.
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    Ramos podem ser expandidos e recolhidos para leitura de redes maiores.
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    O painel lateral exibe perfil, discipulador, discípulos diretos, encontros e observações pastorais.
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
