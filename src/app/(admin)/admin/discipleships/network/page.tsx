import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/server/auth";
import { decryptString } from "@/server/crypto";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { DiscipleshipNetworkClient } from "../DiscipleshipNetworkClient";

export const dynamic = "force-dynamic";

const meetingStatusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  COMPLETED: "Concluído",
  MISSED: "Não realizado",
};

const historyActionLabels: Record<string, string> = {
  CREATED: "Cadastro criado",
  STATUS_CHANGED: "Status alterado",
  MEETING_RECORDED: "Encontro registrado",
  TRANSFERRED: "Transferência realizada",
  PROGRESS_UPDATED: "Progresso atualizado",
};

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function DiscipleshipsNetworkPage(props: { searchParams?: SearchParamsInput }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "discipleships:read")) {
    redirect("/admin");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const initialMemberId = getSearchValue(searchParams?.member) ?? null;

  const [members, rows, meetings, history, pastoralNotes] = await Promise.all([
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
      },
    }),
    prisma.discipleship.findMany({
      orderBy: { updatedAt: "desc" },
      take: 250,
      include: {
        disciple: { select: { id: true, fullName: true, photoUrl: true, phone: true, email: true, type: true } },
        discipler: { select: { id: true, fullName: true, photoUrl: true, phone: true, email: true, type: true } },
      },
    }),
    prisma.discipleshipMeeting.findMany({
      orderBy: { meetingAt: "desc" },
      take: 200,
      include: {
        discipleship: {
          include: {
            disciple: { select: { id: true, fullName: true } },
            discipler: { select: { id: true, fullName: true } },
          },
        },
      },
    }),
    prisma.discipleshipHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        member: { select: { id: true, fullName: true } },
        previousDiscipler: { select: { id: true, fullName: true } },
        newDiscipler: { select: { id: true, fullName: true } },
      },
    }),
    prisma.pastoralNote.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      select: { id: true, memberId: true, title: true, contentEnc: true, createdAt: true },
    }),
  ]);

  const activeRows = rows.filter((row) => row.status === "ACTIVE");

  const { count: countDescendants } = getDescendantCounter(
    activeRows.map((row) => ({ disciplerId: row.disciplerId, discipleId: row.discipleId })),
  );

  const directCountByMember = new Map<string, number>();
  for (const row of activeRows) {
    directCountByMember.set(row.disciplerId, (directCountByMember.get(row.disciplerId) ?? 0) + 1);
  }

  const activeByDisciple = new Map(activeRows.map((row) => [row.discipleId, row]));

  const memberNetworkData = members.map((member) => {
    const active = activeByDisciple.get(member.id) ?? null;
    const directCount = directCountByMember.get(member.id) ?? 0;
    const descendants = countDescendants(member.id);

    return {
      id: member.id,
      fullName: member.fullName,
      photoUrl: member.photoUrl,
      email: member.email,
      phone: member.phone,
      type: (member.types.length ? member.types : [member.type]).join(", "),
      activeStatus: active?.status ?? null,
      activeStartedAt: active?.startedAt.toISOString() ?? null,
      nextMeetingAt: active?.nextMeetingAt?.toISOString() ?? null,
      level: active?.level ?? 1,
      progress: active?.progress ?? 0,
      directCount,
      indirectCount: Math.max(descendants - directCount, 0),
      growthScore: descendants,
    };
  });

  const networkRelationships = rows.map((row) => ({
    id: row.id,
    disciplerId: row.disciplerId,
    discipleId: row.discipleId,
    status: row.status,
    level: row.level,
    progress: row.progress,
    startedAt: row.startedAt.toISOString(),
    nextMeetingAt: row.nextMeetingAt?.toISOString() ?? null,
  }));

  const networkMeetings = meetings.map((meeting) => ({
    id: meeting.id,
    discipleshipId: meeting.discipleshipId,
    meetingAt: meeting.meetingAt.toISOString(),
    theme: meeting.theme,
    notes: meeting.notes,
    nextMeetingAt: meeting.nextMeetingAt?.toISOString() ?? null,
    status: meetingStatusLabels[meeting.status] ?? meeting.status,
    discipleId: meeting.discipleship.disciple.id,
    disciplerId: meeting.discipleship.discipler.id,
    discipleName: meeting.discipleship.disciple.fullName,
    disciplerName: meeting.discipleship.discipler.fullName,
  }));

  const networkHistory = history.map((item) => ({
    id: item.id,
    memberId: item.memberId,
    action: historyActionLabels[item.action] ?? item.action,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    previousDisciplerName: item.previousDiscipler?.fullName ?? null,
    newDisciplerName: item.newDiscipler?.fullName ?? null,
  }));

  let decryptedPastoralNotes: Array<{
    id: string;
    memberId: string;
    title: string | null;
    content: string | null;
    createdAt: string;
  }> = [];
  try {
    decryptedPastoralNotes = pastoralNotes.map((note) => {
      try {
        const decrypted = decryptString(note.contentEnc ?? "");
        return {
          id: note.id,
          memberId: note.memberId,
          title: note.title ?? null,
          content: decrypted ?? null,
          createdAt: note.createdAt.toISOString(),
        };
      } catch {
        return {
          id: note.id,
          memberId: note.memberId,
          title: note.title ?? null,
          content: "[Não foi possível descriptografar este anotação]",
          createdAt: note.createdAt.toISOString(),
        };
      }
    });
  } catch (err) {
    decryptedPastoralNotes = pastoralNotes.map((note) => ({
      id: note.id,
      memberId: note.memberId,
      title: note.title ?? null,
      content: "[Não foi possível descriptografar as anotações pastorais. Verifique a variável de ambiente APP_ENCRYPTION_KEY.]",
      createdAt: note.createdAt.toISOString(),
    }));
    console.error("[discipleships/network] Falha ao descriptografar pastoralNotes:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/discipleships?view=overview"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para Visão Geral
          </Link>
          <div className="mt-2 text-xl font-semibold tracking-tight">Rede de Discipulado</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Visualize a linhagem espiritual completa com zoom, arraste, filtros, busca com foco e expansão de ramos.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/10 px-3 py-1 text-muted-foreground">
            {members.length} membros
          </span>
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/10 px-3 py-1 text-muted-foreground">
            {rows.length} vínculos
          </span>
        </div>
      </div>

      <DiscipleshipNetworkClient
        members={memberNetworkData}
        relationships={networkRelationships}
        meetings={networkMeetings}
        history={networkHistory}
        pastoralNotes={decryptedPastoralNotes}
        initialMemberId={initialMemberId}
      />
    </div>
  );
}
