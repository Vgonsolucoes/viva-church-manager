import { prisma } from "@/server/db";

/**
 * Cursos predefinidos da Trilha Obrigatória.
 * Devem ser criados automaticamente no banco se não existirem.
 * Ordem mantida conforme implementação original.
 */
export const REQUIRED_COURSES = [
  { title: "Ide e Fazer Discípulos", trackOrder: 1 },
  { title: "Lealdade e Honra", trackOrder: 2 },
  { title: "Chamados Para Servir", trackOrder: 3 },
] as const;

/**
 * Nome do evento obrigatório da trilha.
 * Resgate é um evento, não um curso — permanece em FollowUpJourney.
 */
export const REQUIRED_EVENT_TITLE = "Resgate";

/**
 * Garante que os cursos predefinidos da trilha obrigatória existam no banco.
 * Idempotente: só cria cursos ausentes, nunca duplica, nunca sobrescreve.
 */
export async function ensureRequiredCourses(): Promise<void> {
  const now = new Date();

  for (const { title, trackOrder } of REQUIRED_COURSES) {
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

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
