import { prisma } from "@/server/db";

/**
 * Cursos predefinidos da Trilha Obrigatória.
 * Devem ser criados automaticamente no banco se não existirem.
 * Ordem mantida conforme implementação original.
 */
export const REQUIRED_COURSES = [
  { title: "Ide e Fazer Discípulos", trackOrder: 1 },
  { title: "Lealdade e Honra", trackOrder: 2 },
  { title: "Resgate", trackOrder: 3 },
  { title: "Chamados Para Servir", trackOrder: 4 },
] as const;

function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Garante que os cursos predefinidos da trilha obrigatória existam no banco.
 * Idempotente: só cria cursos ausentes, nunca duplica, nunca sobrescreve.
 */
export async function ensureRequiredCourses(): Promise<void> {
  const now = new Date();

  for (const { title, trackOrder } of REQUIRED_COURSES) {
    const slug = slugifyTitle(title);

    const existing = await prisma.course.findUnique({ where: { slug } });

    if (!existing) {
      await prisma.course.create({
        data: {
          title,
          slug,
          startsAt: now,
          isRequired: true,
          trackOrder,
          audience: "BOTH",
          agendaVisible: false,
        },
      });
    } else if (!existing.isRequired || existing.trackOrder !== trackOrder) {
      // Se o curso já existe mas não está marcado como obrigatório, atualiza
      await prisma.course.update({
        where: { id: existing.id },
        data: { isRequired: true, trackOrder },
      });
    }
  }

  await backfillRescueEventCompletions();
}

/**
 * Migra conclusões do antigo "Evento Resgate" (FollowUpJourney.rescueEventCompletedAt)
 * para CourseCompletion do curso Resgate, preservando o progresso já registrado.
 * Idempotente: a unique (courseId, memberId) impede duplicidades.
 * Não apaga o campo original em FollowUpJourney.
 */
async function backfillRescueEventCompletions(): Promise<void> {
  const rescueCourse = await prisma.course.findUnique({
    where: { slug: slugifyTitle("Resgate") },
    select: { id: true },
  });
  if (!rescueCourse) return;

  const journeysWithRescue = await prisma.followUpJourney.findMany({
    where: { rescueEventCompletedAt: { not: null } },
    select: { memberId: true, rescueEventCompletedAt: true },
  });
  if (!journeysWithRescue.length) return;

  await prisma.courseCompletion.createMany({
    data: journeysWithRescue.map((journey) => ({
      courseId: rescueCourse.id,
      memberId: journey.memberId,
      completedAt: journey.rescueEventCompletedAt as Date,
      source: "VIVA_CHURCH" as const,
      notes: "Registrado a partir do evento Resgate (migração automática).",
    })),
    skipDuplicates: true,
  });
}

/**
 * Retorna todos os cursos marcados como obrigatórios, ordenados pela trilha.
 */
export async function getRequiredCourses() {
  return prisma.course.findMany({
    where: { isRequired: true },
    orderBy: { trackOrder: "asc" },
  });
}

/**
 * Retorna as conclusões de um membro para os cursos obrigatórios.
 */
export async function getMemberCourseCompletions(memberId: string) {
  return prisma.courseCompletion.findMany({
    where: { memberId },
    include: { course: true },
    orderBy: { completedAt: "desc" },
  });
}

/**
 * Registra ou atualiza a conclusão de um curso por um membro.
 */
export async function upsertCourseCompletion(params: {
  courseId: string;
  memberId: string;
  completedAt: Date;
  source: "VIVA_CHURCH" | "PREVIOUS" | "OTHER_CHURCH";
  notes?: string;
  createdById?: string;
}) {
  const existing = await prisma.courseCompletion.findUnique({
    where: {
      courseId_memberId: {
        courseId: params.courseId,
        memberId: params.memberId,
      },
    },
  });

  if (existing) {
    return prisma.courseCompletion.update({
      where: { id: existing.id },
      data: {
        completedAt: params.completedAt,
        source: params.source,
        notes: params.notes,
        createdById: params.createdById,
      },
    });
  }

  return prisma.courseCompletion.create({
    data: params,
  });
}

/**
 * Remove (cancela) a conclusão de um curso por um membro.
 */
export async function removeCourseCompletion(courseId: string, memberId: string) {
  return prisma.courseCompletion.deleteMany({
    where: { courseId, memberId },
  });
}
