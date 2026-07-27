import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FollowUpStage, MemberType } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";

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
};

const requiredCourseTitles = [
  "Ide e Fazer Discípulos",
  "Lealdade e Honra",
  "Chamados Para Servir",
] as const;

const requiredEventTitle = "Resgate";

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
  ideDiscipleCompletedAt: optionalTextField,
  loyaltyHonorCompletedAt: optionalTextField,
  calledToServeCompletedAt: optionalTextField,
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getMemberTypes(member: { type: MemberType; types: MemberType[] }) {
  return member.types.length ? member.types : [member.type];
}

function getPrimaryType(types: MemberType[]) {
  if (types.includes("MEMBER")) return "MEMBER" as const;
  if (types.includes("VOLUNTEER")) return "VOLUNTEER" as const;
  return (types[0] ?? "MEMBER") as MemberType;
}

function countCompletedRequirements(journey: {
  ideDiscipleCompletedAt: Date | null;
  loyaltyHonorCompletedAt: Date | null;
  calledToServeCompletedAt: Date | null;
  rescueEventCompletedAt: Date | null;
}) {
  return [
    journey.ideDiscipleCompletedAt,
    journey.loyaltyHonorCompletedAt,
    journey.calledToServeCompletedAt,
    journey.rescueEventCompletedAt,
  ].filter(Boolean).length;
}

function isReadyToServe(journey: {
  ideDiscipleCompletedAt: Date | null;
  loyaltyHonorCompletedAt: Date | null;
  calledToServeCompletedAt: Date | null;
  rescueEventCompletedAt: Date | null;
}) {
  return countCompletedRequirements(journey) === 4;
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
    ideDiscipleCompletedAt: formData.get("ideDiscipleCompletedAt"),
    loyaltyHonorCompletedAt: formData.get("loyaltyHonorCompletedAt"),
    calledToServeCompletedAt: formData.get("calledToServeCompletedAt"),
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
        ideDiscipleCompletedAt: parseOptionalDate(parsed.data.ideDiscipleCompletedAt),
        loyaltyHonorCompletedAt: parseOptionalDate(parsed.data.loyaltyHonorCompletedAt),
        calledToServeCompletedAt: parseOptionalDate(parsed.data.calledToServeCompletedAt),
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
      readyToServe: isReadyToServe(updated),
    },
  });

  revalidatePath("/admin/acompanhamento");
  revalidatePath("/admin/members");
  revalidatePath("/admin/volunteers");
}

export default async function AcompanhamentoPage() {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "followup:read")) {
    redirect("/admin");
  }

  const canWrite = hasPermission(session.roles ?? [], "followup:write");

  const [journeys, eligibleMembers, teamMembers, mappedCourses, rescueEvent] = await Promise.all([
    prisma.followUpJourney.findMany({
      orderBy: [{ nextContactAt: "asc" }, { updatedAt: "desc" }],
      take: 100,
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
          take: 3,
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
        email: true,
        phone: true,
        type: true,
        types: true,
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
    prisma.course.findMany({
      where: {
        OR: requiredCourseTitles.map((title) => ({
          title: { equals: title, mode: "insensitive" },
        })),
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
      },
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

  const journeyMemberIds = new Set(journeys.map((journey) => journey.memberId));
  const availableMembers = eligibleMembers.filter((member) => !journeyMemberIds.has(member.id));
  const totalJourneys = journeys.length;
  const readyToServeCount = journeys.filter((journey) => isReadyToServe(journey)).length;
  const pendingRequirementsCount = journeys.filter(
    (journey) => journey.wantsToServe && !isReadyToServe(journey),
  ).length;
  const membersCount = journeys.filter((journey) => getMemberTypes(journey.member).includes("MEMBER")).length;
  const visitorsCount = journeys.filter((journey) => getMemberTypes(journey.member).includes("VISITOR")).length;
  const courseCatalogMap = new Map(
    mappedCourses.map((course) => [normalizeText(course.title), course]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">Acompanhamento</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Jornada do ministério Acolher para acompanhar visitantes até se tornarem membros e
            voluntários aptos a servir.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge className="bg-[rgba(88,167,255,0.10)]">{totalJourneys} processos ativos</Badge>
          <Badge className="bg-[rgba(88,167,255,0.10)]">{readyToServeCount} aptos a servir</Badge>
          <Badge className="bg-[rgba(88,167,255,0.10)]">{pendingRequirementsCount} com pendências</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Processos
          </div>
          <div className="mt-2 text-3xl font-semibold">{totalJourneys}</div>
          <div className="mt-1 text-sm text-muted-foreground">Pessoas em acompanhamento</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Visitantes
          </div>
          <div className="mt-2 text-3xl font-semibold">{visitorsCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Cadastros ainda com perfil de visitante</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Membros
          </div>
          <div className="mt-2 text-3xl font-semibold">{membersCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Já sincronizados como membros</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Requisitos
          </div>
          <div className="mt-2 text-3xl font-semibold">{readyToServeCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Concluíram cursos e o Resgate</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm font-medium">Trilha obrigatória</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Controle dos requisitos para voluntariado e participação em ministérios.
          </div>
          <div className="mt-4 space-y-3">
            {requiredCourseTitles.map((title) => {
              const catalogItem = courseCatalogMap.get(normalizeText(title));
              return (
                <div
                  key={title}
                  className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="text-xs text-muted-foreground">Curso obrigatório</div>
                    </div>
                    <Badge className={catalogItem ? "bg-[rgba(88,167,255,0.10)]" : "opacity-70"}>
                      {catalogItem ? "Cadastrado" : "Cadastrar em Cursos"}
                    </Badge>
                  </div>
                </div>
              );
            })}
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Processos em andamento</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Controle do acolhimento, da membresia e dos requisitos obrigatórios para servir.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{journeys.length} exibidos</div>
        </div>

        <div className="mt-5 space-y-4">
          {journeys.length ? (
            journeys.map((journey) => {
              const memberTypes = getMemberTypes(journey.member);
              const progress = countCompletedRequirements(journey);
              const readyToServe = isReadyToServe(journey);

              return (
                <div key={journey.id} className="rounded-3xl border border-border/70 bg-muted/10 p-4">
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
                      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2">
                          Ide e Fazer Discípulos:{" "}
                          {journey.ideDiscipleCompletedAt
                            ? toDateInput(journey.ideDiscipleCompletedAt)
                            : "pendente"}
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2">
                          Lealdade e Honra:{" "}
                          {journey.loyaltyHonorCompletedAt
                            ? toDateInput(journey.loyaltyHonorCompletedAt)
                            : "pendente"}
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2">
                          Chamados Para Servir:{" "}
                          {journey.calledToServeCompletedAt
                            ? toDateInput(journey.calledToServeCompletedAt)
                            : "pendente"}
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2">
                          Resgate:{" "}
                          {journey.rescueEventCompletedAt
                            ? toDateInput(journey.rescueEventCompletedAt)
                            : "pendente"}
                        </div>
                      </div>
                    </div>

                    <div className="w-full xl:max-w-[320px]">
                      <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                        <div>Responsável: {journey.assignedToMember?.fullName ?? "Não definido"}</div>
                        <div className="mt-1">Primeira visita: {toDateInput(journey.firstVisitAt) || "—"}</div>
                        <div className="mt-1">Último contato: {toDateInput(journey.lastContactAt) || "—"}</div>
                        <div className="mt-1">Próximo contato: {toDateInput(journey.nextContactAt) || "—"}</div>
                        <div className="mt-1">Progresso dos requisitos: {progress}/4</div>
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
                            <div className="text-xs font-medium text-muted-foreground">
                              Ide e Fazer Discípulos
                            </div>
                            <Input
                              name="ideDiscipleCompletedAt"
                              type="date"
                              defaultValue={toDateInput(journey.ideDiscipleCompletedAt)}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              Lealdade e Honra
                            </div>
                            <Input
                              name="loyaltyHonorCompletedAt"
                              type="date"
                              defaultValue={toDateInput(journey.loyaltyHonorCompletedAt)}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              Chamados Para Servir
                            </div>
                            <Input
                              name="calledToServeCompletedAt"
                              type="date"
                              defaultValue={toDateInput(journey.calledToServeCompletedAt)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">Evento Resgate</div>
                            <Input
                              name="rescueEventCompletedAt"
                              type="date"
                              defaultValue={toDateInput(journey.rescueEventCompletedAt)}
                            />
                          </div>
                          <div className="space-y-2 xl:col-span-3">
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
                          <div key={entry.id} className="rounded-2xl border border-border/60 bg-muted/10 px-3 py-3">
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
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum acompanhamento iniciado ainda.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
