import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import type {
  CourseCompletionSource,
  FollowUpStage,
  MemberType,
  Prisma,
} from "@/generated/prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import {
  ensureRequiredCourses,
  getRequiredCourses,
  upsertCourseCompletion,
  removeCourseCompletion,
} from "@/server/courses";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { AcompanhamentoListControls } from "./AcompanhamentoListControls";

export const dynamic = "force-dynamic";

const followUpStageOptions = [
  { value: "NEW_VISITOR", label: "Novo visitante" },
  { value: "WELCOMED", label: "Acolhido" },
  { value: "IN_PROCESS", label: "Em acompanhamento" },
  { value: "READY_FOR_MEMBERSHIP", label: "Pronto para membresia" },
  { value: "READY_FOR_VOLUNTEERING", label: "Pronto para servir" },
  { value: "COMPLETED", label: "Concluído" },
] as const;

const followUpStageLabels = Object.fromEntries(
  followUpStageOptions.map((option) => [option.value, option.label]),
) as Record<(typeof followUpStageOptions)[number]["value"], string>;

const memberTypeLabels: Record<MemberType, string> = {
  MEMBER: "Membro",
  VISITOR: "Visitante",
  NEW_MEMBER: "Novo membro",
  LEADER: "Líder",
  VOLUNTEER: "Voluntário",
  DISCIPLER: "Discipulador",
  PASTOR: "Pastor",
};

const requiredEventTitle = "Resgate";

const courseCompletionSourceLabels: Record<CourseCompletionSource, string> = {
  VIVA_CHURCH: "Viva Church",
  PREVIOUS: "Anterior",
  OTHER_CHURCH: "Outra igreja",
};

const optionalTextField = z.string().optional().or(z.literal(""));
const followUpStageEnum = z.enum([
  "NEW_VISITOR",
  "WELCOMED",
  "IN_PROCESS",
  "READY_FOR_MEMBERSHIP",
  "READY_FOR_VOLUNTEERING",
  "COMPLETED",
]);

const createJourneySchema = z.object({
  memberId: z.string().min(1),
  assignedToMemberId: optionalTextField,
  stage: followUpStageEnum.default("NEW_VISITOR"),
  firstVisitAt: optionalTextField,
  lastContactAt: optionalTextField,
  nextContactAt: optionalTextField,
  wantsMembership: z.boolean().optional(),
  wantsToServe: z.boolean().optional(),
  notes: optionalTextField,
});

const updateJourneySchema = createJourneySchema.extend({
  journeyId: z.string().min(1),
  rescueEventCompletedAt: optionalTextField,
  historyNote: optionalTextField,
  promoteToMember: z.boolean().optional(),
  promoteToVolunteer: z.boolean().optional(),
});

function parseOptionalDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.length === 10 ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getMemberTypes(member: { type: MemberType; types: MemberType[] }) {
  return member.types.length ? member.types : [member.type];
}

function getPrimaryType(types: MemberType[]) {
  if (types.includes("MEMBER")) return "MEMBER" as const;
  if (types.includes("VOLUNTEER")) return "VOLUNTEER" as const;
  return (types[0] ?? "MEMBER") as MemberType;
}

function countCompletedRequirements(params: {
  requiredCourseIds: string[];
  memberCompletionMap: Map<string, { id: string }> | undefined;
  rescueEventCompletedAt: Date | null;
}) {
  const { requiredCourseIds, memberCompletionMap, rescueEventCompletedAt } = params;
  let count = 0;
  for (const courseId of requiredCourseIds) {
    if (memberCompletionMap?.has(courseId)) count += 1;
  }
  if (rescueEventCompletedAt) count += 1;
  return count;
}

function isReadyToServe(params: {
  requiredCourseIds: string[];
  memberCompletionMap: Map<string, { id: string }> | undefined;
  rescueEventCompletedAt: Date | null;
}) {
  const { requiredCourseIds } = params;
  return countCompletedRequirements(params) === requiredCourseIds.length + 1;
}

async function createJourney(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "followup:write")) return;

  const parsed = createJourneySchema.safeParse({
    memberId: formData.get("memberId"),
    assignedToMemberId: formData.get("assignedToMemberId"),
    stage: formData.get("stage"),
    firstVisitAt: formData.get("firstVisitAt"),
    lastContactAt: formData.get("lastContactAt"),
    nextContactAt: formData.get("nextContactAt"),
    wantsMembership: formData.get("wantsMembership") === "on",
    wantsToServe: formData.get("wantsToServe") === "on",
    notes: formData.get("notes"),
  });
  if (!parsed.success) return;

  const member = await prisma.member.findFirst({
    where: {
      id: parsed.data.memberId,
      OR: [
        { type: { in: ["VISITOR", "MEMBER", "NEW_MEMBER"] } },
        { types: { hasSome: ["VISITOR", "MEMBER", "NEW_MEMBER"] } },
      ],
    },
    select: { id: true, fullName: true },
  });
  if (!member) return;

  const existing = await prisma.followUpJourney.findUnique({
    where: { memberId: member.id },
    select: { id: true },
  });
  if (existing) return;

  const created = await prisma.followUpJourney.create({
    data: {
      memberId: member.id,
      assignedToMemberId: parsed.data.assignedToMemberId?.trim() || null,
      stage: parsed.data.stage,
      firstVisitAt: parseOptionalDate(parsed.data.firstVisitAt),
      lastContactAt: parseOptionalDate(parsed.data.lastContactAt),
      nextContactAt: parseOptionalDate(parsed.data.nextContactAt),
      wantsMembership: Boolean(parsed.data.wantsMembership),
      wantsToServe: Boolean(parsed.data.wantsToServe),
      notes: parsed.data.notes?.trim() || null,
      createdById: session.uid,
      historyEntries: {
        create: {
          title: "Acompanhamento iniciado",
          note: parsed.data.notes?.trim() || "Processo iniciado para este cadastro.",
          createdById: session.uid,
        },
      },
    },
    include: {
      member: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  await logAudit({
    actorUserId: session.uid,
    action: "CREATE",
    entityType: "FollowUpJourney",
    entityId: created.id,
    after: {
      id: created.id,
      memberId: created.memberId,
      memberName: created.member.fullName,
      stage: created.stage,
      wantsMembership: created.wantsMembership,
      wantsToServe: created.wantsToServe,
    },
  });

  revalidatePath("/admin/acompanhamento");
}

async function updateJourney(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "followup:write")) return;

  const parsed = updateJourneySchema.safeParse({
    journeyId: formData.get("journeyId"),
    memberId: formData.get("memberId"),
    assignedToMemberId: formData.get("assignedToMemberId"),
    stage: formData.get("stage"),
    firstVisitAt: formData.get("firstVisitAt"),
    lastContactAt: formData.get("lastContactAt"),
    nextContactAt: formData.get("nextContactAt"),
    wantsMembership: formData.get("wantsMembership") === "on",
    wantsToServe: formData.get("wantsToServe") === "on",
    notes: formData.get("notes"),
    rescueEventCompletedAt: formData.get("rescueEventCompletedAt"),
    historyNote: formData.get("historyNote"),
    promoteToMember: formData.get("promoteToMember") === "on",
    promoteToVolunteer: formData.get("promoteToVolunteer") === "on",
  });
  if (!parsed.success) return;

  const before = await prisma.followUpJourney.findUnique({
    where: { id: parsed.data.journeyId },
    include: {
      member: {
        select: {
          id: true,
          fullName: true,
          type: true,
          types: true,
        },
      },
    },
  });
  if (!before || before.memberId !== parsed.data.memberId) return;

  const nextAssignedToMemberId = parsed.data.assignedToMemberId?.trim() || null;
  const nextNotes = parsed.data.notes?.trim() || null;
  const nextStage = parsed.data.stage as FollowUpStage;
  const promoteToMember = Boolean(parsed.data.promoteToMember);
  const promoteToVolunteer = Boolean(parsed.data.promoteToVolunteer);
  const historyNote = parsed.data.historyNote?.trim() || "";

  const currentTypes = getMemberTypes(before.member);
  const nextTypes = Array.from(
    new Set<MemberType>([
      ...currentTypes,
      ...(promoteToMember ? (["MEMBER"] as MemberType[]) : []),
      ...(promoteToVolunteer ? (["VOLUNTEER"] as MemberType[]) : []),
    ]),
  );
  const memberTypesChanged =
    nextTypes.length !== currentTypes.length ||
    nextTypes.some((type, index) => type !== currentTypes[index]);
  const nextPrimaryType = getPrimaryType(nextTypes);

  const historyParts: string[] = [];
  if (before.stage !== nextStage) {
    historyParts.push(`Etapa alterada para ${followUpStageLabels[nextStage]}.`);
  }
  if (promoteToMember && !currentTypes.includes("MEMBER")) {
    historyParts.push("Cadastro principal marcado como membro.");
  }
  if (promoteToVolunteer && !currentTypes.includes("VOLUNTEER")) {
    historyParts.push("Cadastro principal marcado como voluntário.");
  }
  if (historyNote) {
    historyParts.push(historyNote);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (memberTypesChanged) {
      await tx.member.update({
        where: { id: before.member.id },
        data: {
          type: nextPrimaryType,
          types: nextTypes,
        },
      });
    }

    const journey = await tx.followUpJourney.update({
      where: { id: before.id },
      data: {
        assignedToMemberId: nextAssignedToMemberId,
        stage: nextStage,
        firstVisitAt: parseOptionalDate(parsed.data.firstVisitAt),
        lastContactAt: parseOptionalDate(parsed.data.lastContactAt),
        nextContactAt: parseOptionalDate(parsed.data.nextContactAt),
        wantsMembership: Boolean(parsed.data.wantsMembership),
        wantsToServe: Boolean(parsed.data.wantsToServe),
        rescueEventCompletedAt: parseOptionalDate(parsed.data.rescueEventCompletedAt),
        notes: nextNotes,
      },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            type: true,
            types: true,
          },
        },
      },
    });

    if (historyParts.length) {
      await tx.followUpHistory.create({
        data: {
          journeyId: journey.id,
          title: "Atualização do acompanhamento",
          note: historyParts.join(" "),
          createdById: session.uid,
        },
      });
    }

    return journey;
  });

  await logAudit({
    actorUserId: session.uid,
    action: "UPDATE",
    entityType: "FollowUpJourney",
    entityId: updated.id,
    before: {
      stage: before.stage,
      wantsMembership: before.wantsMembership,
      wantsToServe: before.wantsToServe,
      assignedToMemberId: before.assignedToMemberId,
      memberTypes: currentTypes,
    },
    after: {
      stage: updated.stage,
      wantsMembership: updated.wantsMembership,
      wantsToServe: updated.wantsToServe,
      assignedToMemberId: updated.assignedToMemberId,
      memberTypes: getMemberTypes(updated.member),
    },
  });

  revalidatePath("/admin/acompanhamento");
  revalidatePath("/admin/members");
  revalidatePath("/admin/volunteers");
}

async function recordCourseCompletion(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "followup:write")) return;

  const courseId = formData.get("courseId") as string;
  const memberId = formData.get("memberId") as string;
  const completedAt = formData.get("completedAt") as string;
  const source = formData.get("source") as string;
  const notes = formData.get("notes") as string;

  if (!courseId || !memberId || !completedAt || !source) return;

  const completedDate = new Date(completedAt + "T00:00:00");

  await upsertCourseCompletion({
    courseId,
    memberId,
    completedAt: completedDate,
    source: source as CourseCompletionSource,
    notes: notes?.trim() || undefined,
    createdById: session.uid,
  });

  await logAudit({
    actorUserId: session.uid,
    action: "COURSE_COMPLETION_RECORDED",
    entityType: "CourseCompletion",
    entityId: `${courseId}_${memberId}`,
    after: {
      courseId,
      memberId,
      completedAt: completedDate,
      source,
      notes: notes?.trim() || null,
    },
  });

  revalidatePath("/admin/acompanhamento");
}

async function revokeCourseCompletion(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "followup:write")) return;

  const courseId = formData.get("courseId") as string;
  const memberId = formData.get("memberId") as string;

  if (!courseId || !memberId) return;

  await removeCourseCompletion(courseId, memberId);

  await logAudit({
    actorUserId: session.uid,
    action: "COURSE_COMPLETION_REVOKED",
    entityType: "CourseCompletion",
    entityId: `${courseId}_${memberId}`,
    before: { courseId, memberId },
  });

  revalidatePath("/admin/acompanhamento");
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">
        {done}/{total} ({pct}%)
      </span>
    </div>
  );
}

export default async function AcompanhamentoPage(props: {
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "followup:read")) {
    redirect("/admin");
  }

  const canWrite = hasPermission(session.roles ?? [], "followup:write");

  await ensureRequiredCourses();

  const sp = props.searchParams ? await props.searchParams : {};
  const getParam = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };

  const q = getParam("q").trim();
  const statusRaw = getParam("status");
  const status = ["in_progress", "completed"].includes(statusRaw) ? statusRaw : "all";
  const stageRaw = getParam("stage");
  const stageValues = new Set<string>(followUpStageOptions.map((option) => option.value));
  const stage = stageValues.has(stageRaw) ? stageRaw : "all";
  const takeRaw = Number.parseInt(getParam("take") || "20", 10);
  const take = [10, 20, 50].includes(takeRaw) ? takeRaw : 20;
  const page = Math.max(1, Number.parseInt(getParam("page") || "1", 10) || 1);
  const selectedJourneyId = getParam("membro").trim();

  const requiredCourses = await getRequiredCourses();
  const requiredCourseIds = requiredCourses.map((course) => course.id);
  const totalRequirements = requiredCourseIds.length + 1;

  const buildListHref = (overrides: Record<string, string | null> = {}, pageForHref?: number) => {
    const effectivePage = pageForHref ?? page;
    const state: Record<string, string | null> = {
      q: q || null,
      status: status === "all" ? null : status,
      stage: stage === "all" ? null : stage,
      take: take === 20 ? null : String(take),
      page: effectivePage > 1 ? String(effectivePage) : null,
      membro: null,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/admin/acompanhamento?${qs}` : "/admin/acompanhamento";
  };

  // ─── Detalhe individual do processo ────────────────────────────────────────
  if (selectedJourneyId) {
    const journey = await prisma.followUpJourney.findUnique({
      where: { id: selectedJourneyId },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            type: true,
            types: true,
            city: true,
            state: true,
          },
        },
        assignedToMember: {
          select: {
            id: true,
            fullName: true,
          },
        },
        historyEntries: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            createdBy: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!journey) {
      return (
        <div className="space-y-6">
          <Link
            href={buildListHref()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary"
          >
            ← Voltar para Processos em Andamento
          </Link>
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">
              Processo de acompanhamento não encontrado. Ele pode ter sido removido.
            </div>
          </Card>
        </div>
      );
    }

    const [teamMembers, memberCompletions] = await Promise.all([
      prisma.member.findMany({
        orderBy: { fullName: "asc" },
        take: 500,
        select: {
          id: true,
          fullName: true,
        },
      }),
      prisma.courseCompletion.findMany({
        where: { memberId: journey.memberId },
        include: { course: true },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    const memberTypes = getMemberTypes(journey.member);
    const memberCompletionMap = new Map(
      memberCompletions.map((completion) => [completion.courseId, completion]),
    );
    const progress = countCompletedRequirements({
      requiredCourseIds,
      memberCompletionMap,
      rescueEventCompletedAt: journey.rescueEventCompletedAt,
    });
    const readyToServe = isReadyToServe({
      requiredCourseIds,
      memberCompletionMap,
      rescueEventCompletedAt: journey.rescueEventCompletedAt,
    });
    const progressPct = totalRequirements > 0 ? Math.round((progress / totalRequirements) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <Link
            href={buildListHref()}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            ← Voltar para Processos em Andamento
          </Link>
          <div>
            <div className="text-xl font-semibold tracking-tight">
              Acompanhamento → {journey.member.fullName}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Detalhe completo do processo, da trilha obrigatória e do histórico.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-muted/10 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold">{journey.member.fullName}</div>
                <Badge>{followUpStageLabels[journey.stage]}</Badge>
                {readyToServe ? (
                  <Badge className="bg-[rgba(88,167,255,0.10)]">Apto a servir</Badge>
                ) : null}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {journey.member.email ?? "Sem e-mail"}
                {journey.member.phone ? ` • ${journey.member.phone}` : ""}
                {journey.member.city || journey.member.state
                  ? ` • ${[journey.member.city, journey.member.state].filter(Boolean).join("/")}`
                  : ""}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {memberTypes.map((type) => (
                  <Badge key={type} className="bg-[rgba(88,167,255,0.10)]">
                    {memberTypeLabels[type]}
                  </Badge>
                ))}
                {journey.wantsMembership ? <Badge>Quer ser membro</Badge> : null}
                {journey.wantsToServe ? <Badge>Quer servir</Badge> : null}
              </div>

              <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Progresso dos requisitos
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {progress}/{totalRequirements} ({progressPct}%)
                  </div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                {requiredCourses.map((course) => {
                  const completion = memberCompletionMap.get(course.id);
                  return (
                    <div
                      key={course.id}
                      className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-foreground">{course.title}</div>
                        {completion ? (
                          <Badge className="bg-[rgba(88,167,255,0.10)]">Concluído</Badge>
                        ) : (
                          <Badge className="opacity-70">Pendente</Badge>
                        )}
                      </div>
                      {completion ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {toDateInput(completion.completedAt)} •{" "}
                          {courseCompletionSourceLabels[completion.source]}
                        </div>
                      ) : canWrite ? (
                        <form action={recordCourseCompletion} className="mt-2 space-y-2">
                          <input type="hidden" name="courseId" value={course.id} />
                          <input type="hidden" name="memberId" value={journey.memberId} />
                          <Input name="completedAt" type="date" required />
                          <select
                            name="source"
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            defaultValue="VIVA_CHURCH"
                            required
                          >
                            <option value="VIVA_CHURCH">Viva Church</option>
                            <option value="PREVIOUS">Anterior</option>
                            <option value="OTHER_CHURCH">Outra igreja</option>
                          </select>
                          <Input name="notes" placeholder="Observação" />
                          <Button type="submit" size="sm" className="w-full">
                            Marcar concluído
                          </Button>
                        </form>
                      ) : (
                        <div className="mt-1 text-xs">pendente</div>
                      )}
                    </div>
                  );
                })}
                <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-foreground">{requiredEventTitle}</div>
                    {journey.rescueEventCompletedAt ? (
                      <Badge className="bg-[rgba(88,167,255,0.10)]">Concluído</Badge>
                    ) : (
                      <Badge className="opacity-70">Pendente</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {journey.rescueEventCompletedAt
                      ? toDateInput(journey.rescueEventCompletedAt)
                      : "pendente"}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full xl:max-w-[320px]">
              <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                <div>Responsável: {journey.assignedToMember?.fullName ?? "Não definido"}</div>
                <div className="mt-1">Primeira visita: {toDateInput(journey.firstVisitAt) || "—"}</div>
                <div className="mt-1">Último contato: {toDateInput(journey.lastContactAt) || "—"}</div>
                <div className="mt-1">Próximo contato: {toDateInput(journey.nextContactAt) || "—"}</div>
                <div className="mt-3">
                  <Link
                    href={`/admin/members?edit=${journey.member.id}`}
                    className="text-xs font-semibold text-foreground hover:text-primary"
                  >
                    Abrir cadastro no módulo Membros
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {journey.notes ? (
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
              {journey.notes}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Histórico de Cursos
            </div>
            {memberCompletions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {memberCompletions.map((completion) => (
                  <div
                    key={completion.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/10 px-3 py-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {completion.course.title}
                        {completion.course.isRequired ? <Badge>Obrigatório</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Conclusão: {toDateInput(completion.completedAt)} • Origem:{" "}
                        {courseCompletionSourceLabels[completion.source]}
                        {completion.notes ? ` • ${completion.notes}` : ""}
                      </div>
                    </div>
                    {canWrite ? (
                      <form action={revokeCourseCompletion}>
                        <input type="hidden" name="courseId" value={completion.courseId} />
                        <input type="hidden" name="memberId" value={journey.memberId} />
                        <Button type="submit" variant="outline" size="sm">
                          Cancelar
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">Nenhum curso registrado.</div>
            )}
          </div>

          <div className="mt-4">
            {canWrite ? (
              <form action={updateJourney} className="space-y-4">
                <input type="hidden" name="journeyId" value={journey.id} />
                <input type="hidden" name="memberId" value={journey.memberId} />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Etapa</div>
                    <select
                      name="stage"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      defaultValue={journey.stage}
                    >
                      {followUpStageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Responsável</div>
                    <select
                      name="assignedToMemberId"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      defaultValue={journey.assignedToMemberId ?? ""}
                    >
                      <option value="">Sem responsável definido</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Último contato</div>
                    <Input
                      name="lastContactAt"
                      type="date"
                      defaultValue={toDateInput(journey.lastContactAt)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Próximo contato</div>
                    <Input
                      name="nextContactAt"
                      type="date"
                      defaultValue={toDateInput(journey.nextContactAt)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Primeira visita</div>
                    <Input
                      name="firstVisitAt"
                      type="date"
                      defaultValue={toDateInput(journey.firstVisitAt)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Evento Resgate</div>
                    <Input
                      name="rescueEventCompletedAt"
                      type="date"
                      defaultValue={toDateInput(journey.rescueEventCompletedAt)}
                    />
                  </div>
                  <div className="space-y-2 xl:col-span-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Observação da atualização
                    </div>
                    <Input
                      name="historyNote"
                      placeholder="Ex: concluiu o curso e foi encaminhado para o próximo passo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Resumo do processo</div>
                    <textarea
                      name="notes"
                      defaultValue={journey.notes ?? ""}
                      className="min-h-24 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      placeholder="Resumo geral do acolhimento, necessidades e próximos passos"
                    />
                  </div>
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="wantsMembership"
                        className="size-4"
                        defaultChecked={journey.wantsMembership}
                      />
                      <span>Deseja seguir para membresia</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="wantsToServe"
                        className="size-4"
                        defaultChecked={journey.wantsToServe}
                      />
                      <span>Deseja servir em ministério</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="promoteToMember" className="size-4" />
                      <span>Marcar cadastro principal como membro</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="promoteToVolunteer" className="size-4" />
                      <span>Marcar cadastro principal como voluntário</span>
                    </label>
                    <div className="text-xs text-muted-foreground">
                      Use essas opções quando o processo estiver avançado ou concluído.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit">Salvar acompanhamento</Button>
                </div>
              </form>
            ) : null}
          </div>

          {journey.historyEntries.length ? (
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Histórico recente
              </div>
              <div className="mt-3 space-y-3">
                {journey.historyEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-border/60 bg-muted/10 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{entry.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(entry.createdAt)}
                      </div>
                    </div>
                    {entry.note ? (
                      <div className="mt-2 text-sm text-muted-foreground">{entry.note}</div>
                    ) : null}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {entry.createdBy?.name ?? entry.createdBy?.email ?? "Sistema"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ─── Lista compacta de processos ───────────────────────────────────────────
  const andConditions: Prisma.FollowUpJourneyWhereInput[] = [];
  if (status === "in_progress") andConditions.push({ stage: { not: "COMPLETED" } });
  if (status === "completed") andConditions.push({ stage: "COMPLETED" });
  if (stage !== "all") andConditions.push({ stage: stage as FollowUpStage });
  if (q) {
    const memberOr: Prisma.MemberWhereInput[] = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 3 && digits !== q) {
      memberOr.push({ phone: { contains: digits } });
    }
    andConditions.push({ member: { OR: memberOr } });
  }
  const where: Prisma.FollowUpJourneyWhereInput = andConditions.length
    ? { AND: andConditions }
    : {};

  const readyConditions: Prisma.FollowUpJourneyWhereInput[] = [
    { rescueEventCompletedAt: { not: null } },
    ...requiredCourseIds.map((courseId) => ({
      member: { courseCompletions: { some: { courseId } } },
    })),
  ];

  const [totalFiltered, totalAll, inProgressCount, completedCount, pendingCount] =
    await Promise.all([
      prisma.followUpJourney.count({ where }),
      prisma.followUpJourney.count(),
      prisma.followUpJourney.count({ where: { stage: { not: "COMPLETED" } } }),
      prisma.followUpJourney.count({ where: { stage: "COMPLETED" } }),
      prisma.followUpJourney.count({
        where: { wantsToServe: true, NOT: { AND: readyConditions } },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / take));
  const currentPage = Math.min(page, totalPages);

  const [journeys, eligibleMembers, teamMembers, allJourneyMemberIds, rescueEvent] =
    await Promise.all([
      prisma.followUpJourney.findMany({
        where,
        orderBy: [{ member: { fullName: "asc" } }],
        skip: (currentPage - 1) * take,
        take,
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              type: true,
              types: true,
            },
          },
          assignedToMember: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.member.findMany({
        where: {
          OR: [
            { type: { in: ["VISITOR", "MEMBER", "NEW_MEMBER"] } },
            { types: { hasSome: ["VISITOR", "MEMBER", "NEW_MEMBER"] } },
          ],
        },
        orderBy: { fullName: "asc" },
        take: 500,
        select: {
          id: true,
          fullName: true,
        },
      }),
      prisma.member.findMany({
        orderBy: { fullName: "asc" },
        take: 500,
        select: {
          id: true,
          fullName: true,
        },
      }),
      prisma.followUpJourney.findMany({
        select: { memberId: true },
      }),
      prisma.event.findFirst({
        where: {
          name: { equals: requiredEventTitle, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          startsAt: true,
        },
      }),
    ]);

  const journeyMemberIds = new Set(allJourneyMemberIds.map((entry) => entry.memberId));
  const availableMembers = eligibleMembers.filter((member) => !journeyMemberIds.has(member.id));

  const pageMemberIds = journeys.map((journey) => journey.memberId);
  const pageCompletions = pageMemberIds.length
    ? await prisma.courseCompletion.findMany({
        where: {
          memberId: { in: pageMemberIds },
          courseId: { in: requiredCourseIds },
        },
        select: { memberId: true, courseId: true },
      })
    : [];
  const completedCourseIdsByMember = new Map<string, Set<string>>();
  for (const completion of pageCompletions) {
    const set = completedCourseIdsByMember.get(completion.memberId) ?? new Set<string>();
    set.add(completion.courseId);
    completedCourseIdsByMember.set(completion.memberId, set);
  }

  const from = totalFiltered === 0 ? 0 : (currentPage - 1) * take + 1;
  const to = Math.min(currentPage * take, totalFiltered);

  const openLinkClass =
    "inline-flex h-8 items-center rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Acompanhamento</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Jornada do ministério Acolher para acompanhar visitantes até se tornarem membros e
          voluntários aptos a servir.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total em acompanhamento
          </div>
          <div className="mt-2 text-3xl font-semibold">{totalAll}</div>
          <div className="mt-1 text-sm text-muted-foreground">Processos registrados</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Em andamento
          </div>
          <div className="mt-2 text-3xl font-semibold">{inProgressCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Processos ainda não concluídos</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concluídos
          </div>
          <div className="mt-2 text-3xl font-semibold">{completedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Jornadas finalizadas</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Com pendências
          </div>
          <div className="mt-2 text-3xl font-semibold">{pendingCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Querem servir e ainda têm requisitos pendentes
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm font-medium">Trilha obrigatória</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Controle dos requisitos para voluntariado e participação em ministérios.
          </div>
          <div className="mt-4 space-y-3">
            {requiredCourses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{course.title}</div>
                    <div className="text-xs text-muted-foreground">Curso obrigatório</div>
                  </div>
                  <Badge className="bg-[rgba(88,167,255,0.10)]">Cadastrado</Badge>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{requiredEventTitle}</div>
                  <div className="text-xs text-muted-foreground">Evento obrigatório</div>
                </div>
                <Badge className={rescueEvent ? "bg-[rgba(88,167,255,0.10)]" : "opacity-70"}>
                  {rescueEvent ? "Cadastrado" : "Cadastrar em Eventos"}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Origem dos cadastros</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Esta tela usa os registros do menu Membros marcados como visitante, novo membro ou
            membro.
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-3">
              {eligibleMembers.length} cadastros elegíveis para iniciar acompanhamento.
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-3">
              {availableMembers.length} ainda não possuem processo iniciado.
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-3">
              Ao concluir a jornada, você pode sincronizar o cadastro como membro e voluntário.
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Novo acompanhamento</div>
          {canWrite ? (
            <form action={createJourney} className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Pessoa</div>
                <select
                  name="memberId"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecionar cadastro
                  </option>
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Responsável</div>
                <select
                  name="assignedToMemberId"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">Sem responsável definido</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Etapa</div>
                  <select
                    name="stage"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    defaultValue="NEW_VISITOR"
                  >
                    {followUpStageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Primeira visita</div>
                  <Input name="firstVisitAt" type="date" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Último contato</div>
                  <Input name="lastContactAt" type="date" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Próximo contato</div>
                  <Input name="nextContactAt" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="wantsMembership" className="size-4" />
                  <span>Deseja caminhar para membresia</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="wantsToServe" className="size-4" />
                  <span>Deseja servir em ministério</span>
                </label>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Observações iniciais</div>
                <textarea
                  name="notes"
                  className="min-h-24 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Ex: veio pela primeira vez no culto de domingo e deseja conhecer a igreja."
                />
              </div>
              <Button className="w-full" type="submit" disabled={!availableMembers.length}>
                Iniciar acompanhamento
              </Button>
            </form>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Você possui acesso de leitura a esta área, mas sem permissão de alteração.
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium">Processos em Andamento</div>
          <div className="text-sm text-muted-foreground">
            Pesquise e selecione uma pessoa para abrir o processo completo.
          </div>
        </div>

        <div className="mt-4">
          <AcompanhamentoListControls
            stageOptions={followUpStageOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </div>

        <div className="mt-5">
          {journeys.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Membro</th>
                      <th className="py-2 pr-4 font-medium">Etapa atual</th>
                      <th className="py-2 pr-4 font-medium">Progresso</th>
                      <th className="py-2 text-right font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map((journey) => {
                      const done =
                        (completedCourseIdsByMember.get(journey.memberId)?.size ?? 0) +
                        (journey.rescueEventCompletedAt ? 1 : 0);
                      return (
                        <tr key={journey.id} className="border-t border-border/60">
                          <td className="py-3 pr-4">
                            <div className="font-semibold">{journey.member.fullName}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {journey.member.phone ?? journey.member.email ?? "—"}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge>{followUpStageLabels[journey.stage]}</Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <ProgressBar done={done} total={totalRequirements} />
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              href={buildListHref({ membro: journey.id }, currentPage)}
                              className={openLinkClass}
                            >
                              Abrir
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {journeys.map((journey) => {
                  const done =
                    (completedCourseIdsByMember.get(journey.memberId)?.size ?? 0) +
                    (journey.rescueEventCompletedAt ? 1 : 0);
                  return (
                    <div
                      key={journey.id}
                      className="rounded-2xl border border-border/70 bg-muted/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{journey.member.fullName}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {journey.member.phone ?? journey.member.email ?? "—"}
                          </div>
                        </div>
                        <Badge>{followUpStageLabels[journey.stage]}</Badge>
                      </div>
                      <div className="mt-3">
                        <ProgressBar done={done} total={totalRequirements} />
                      </div>
                      <Link
                        href={buildListHref({ membro: journey.id }, currentPage)}
                        className={`${openLinkClass} mt-3 w-full justify-center`}
                      >
                        Abrir
                      </Link>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-muted-foreground">
                  Exibindo {from}–{to} de {totalFiltered} acompanhamentos
                </div>
                <div className="flex items-center gap-2">
                  {currentPage > 1 ? (
                    <Link
                      href={buildListHref({ page: currentPage - 1 > 1 ? String(currentPage - 1) : null })}
                      className={openLinkClass}
                    >
                      ← Anterior
                    </Link>
                  ) : (
                    <span className={`${openLinkClass} pointer-events-none opacity-50`}>
                      ← Anterior
                    </span>
                  )}
                  <span className="px-2 text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  {currentPage < totalPages ? (
                    <Link href={buildListHref({ page: String(currentPage + 1) })} className={openLinkClass}>
                      Próxima →
                    </Link>
                  ) : (
                    <span className={`${openLinkClass} pointer-events-none opacity-50`}>
                      Próxima →
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              {q || status !== "all" || stage !== "all"
                ? "Nenhum acompanhamento encontrado para a pesquisa/filtros aplicados."
                : "Nenhum acompanhamento iniciado ainda."}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
