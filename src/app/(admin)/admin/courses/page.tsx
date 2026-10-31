import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { MemberType, RoleKey } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { createNotificationCampaign } from "@/server/notifications";
import { hasPermission } from "@/server/rbac";
import { savePublicImageUpload } from "@/server/uploads";
import { ensureRequiredCourses } from "@/server/courses";

export const dynamic = "force-dynamic";

const courseSchema = z
  .object({
    title: z.string().trim().min(2),
    description: z.string().optional().or(z.literal("")),
    details: z.string().optional().or(z.literal("")),
    instructorName: z.string().optional().or(z.literal("")),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/).refine((value) => Number.isFinite(new Date(`${value}-03:00`).getTime())),
    endsAt: z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value) && Number.isFinite(new Date(`${value}-03:00`).getTime()))).optional(),
    location: z.string().optional().or(z.literal("")),
    bannerImageUrl: z.string().refine((value) => !value || value.startsWith("/uploads/") || URL.canParse(value), "Imagem inválida").optional(),
    audience: z.enum(["MEMBERS", "VOLUNTEERS", "BOTH"]).default("BOTH"),
    agendaVisible: z.string().optional(),
    notifyAdmins: z.string().optional(),
    notifyMembers: z.string().optional(),
    notifyVolunteers: z.string().optional(),
    notifyVisitors: z.string().optional(),
    isRequired: z.string().optional(),
    trackOrder: z.string().optional(),
  })
  .refine(
    (data) => !data.endsAt || new Date(data.endsAt).getTime() >= new Date(data.startsAt).getTime(),
    {
      message: "A data final precisa ser maior ou igual a inicial.",
      path: ["endsAt"],
    },
  );

const audienceLabel: Record<"MEMBERS" | "VOLUNTEERS" | "BOTH", string> = {
  MEMBERS: "Membros",
  VOLUNTEERS: "Voluntários",
  BOTH: "Membros e voluntários",
};

const adminRoles: RoleKey[] = [
  "SUPER_ADMIN",
  "PASTOR_PRESIDENTE",
  "PASTOR",
  "MINISTRY_LEADER",
  "CELL_LEADER",
  "FINANCE",
  "SECRETARY",
  "RECEPTION",
  "KIDS_MINISTRY",
  "PARKING",
];

const memberAudienceTypes: MemberType[] = ["MEMBER", "NEW_MEMBER", "LEADER", "DISCIPLER"];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function generateUniqueSlug(title: string) {
  const baseSlug = slugify(title) || "curso";
  let slug = baseSlug;
  let counter = 2;

  while (await prisma.course.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function saveCourse(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session?.uid || !hasPermission(session.roles ?? [], "courses:write")) return;

  const courseId = String(formData.get("courseId") ?? "");
  const existing = courseId ? await prisma.course.findUnique({ where: { id: courseId } }) : null;
  if (courseId && !existing) redirect("/admin/courses?error=missing");

  const parsed = courseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    details: formData.get("details"),
    instructorName: formData.get("instructorName"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location"),
    bannerImageUrl: formData.get("bannerImageUrl"),
    audience: formData.get("audience"),
    agendaVisible: formData.get("agendaVisible") ?? undefined,
    notifyAdmins: formData.get("notifyAdmins") ?? undefined,
    notifyMembers: formData.get("notifyMembers") ?? undefined,
    notifyVolunteers: formData.get("notifyVolunteers") ?? undefined,
    notifyVisitors: formData.get("notifyVisitors") ?? undefined,
    isRequired: formData.get("isRequired") ?? undefined,
    trackOrder: formData.get("trackOrder"),
  });
  if (!parsed.success) redirect(`/admin/courses?${courseId ? `edit=${encodeURIComponent(courseId)}&` : ""}error=invalid#course-form`);

  const bannerFile = formData.get("bannerFile");
  const uploadedBannerUrl = await savePublicImageUpload(bannerFile as unknown as File);
  const bannerImageUrl = uploadedBannerUrl ?? (parsed.data.bannerImageUrl || null);

  const slug = existing?.slug ?? await generateUniqueSlug(parsed.data.title);
  const startsAt = new Date(`${parsed.data.startsAt}-03:00`);
  const endsAt = parsed.data.endsAt ? new Date(`${parsed.data.endsAt}-03:00`) : null;
  const notifyAdmins = parsed.data.notifyAdmins === "on";
  const notifyMembers = parsed.data.notifyMembers === "on";
  const notifyVolunteers = parsed.data.notifyVolunteers === "on";
  const notifyVisitors = parsed.data.notifyVisitors === "on";

  const data = {
      title: parsed.data.title.trim(),
      slug,
      description: parsed.data.description ? parsed.data.description.trim() : null,
      details: parsed.data.details ? parsed.data.details.trim() : null,
      instructorName: parsed.data.instructorName ? parsed.data.instructorName.trim() : null,
      startsAt,
      endsAt,
      location: parsed.data.location ? parsed.data.location.trim() : null,
      bannerImageUrl,
      audience: parsed.data.audience,
      agendaVisible: parsed.data.agendaVisible === "on",
      isRequired: parsed.data.isRequired === "on",
      trackOrder: parsed.data.trackOrder ? parseInt(parsed.data.trackOrder, 10) || null : null,
      notifyAdmins,
      notifyMembers,
      notifyVolunteers,
      notifyVisitors,
    };
  const course = existing
    ? await prisma.course.update({ where: { id: existing.id }, data })
    : await prisma.course.create({ data: { ...data, createdById: session.uid } });

  const targetRoles = notifyAdmins ? adminRoles : [];
  const targetMemberTypes = Array.from(
    new Set<MemberType>([
      ...(notifyMembers ? memberAudienceTypes : []),
      ...(notifyVolunteers ? (["VOLUNTEER"] as MemberType[]) : []),
      ...(notifyVisitors ? (["VISITOR"] as MemberType[]) : []),
    ]),
  );

  if (!existing && (targetRoles.length || targetMemberTypes.length)) {
    const formattedDate = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(course.startsAt);
    const locationText = course.location ? ` Local: ${course.location}.` : "";
    const instructorText = course.instructorName ? ` Instrutor: ${course.instructorName}.` : "";

    await createNotificationCampaign({
      title: `Novo curso: ${course.title}`,
      body: `${course.title} foi lançado para ${audienceLabel[course.audience]}. Início: ${formattedDate}.${locationText}${instructorText}`,
      createdById: session.uid,
      targetRoles,
      targetMemberTypes,
    });
  }

  await logAudit({
    actorUserId: session.uid,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "Course",
    before: existing ?? undefined,
    entityId: course.id,
    after: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      audience: course.audience,
      startsAt: course.startsAt,
      agendaVisible: course.agendaVisible,
      isRequired: course.isRequired,
      trackOrder: course.trackOrder,
      notifyAdmins,
      notifyMembers,
      notifyVolunteers,
      notifyVisitors,
      bannerImageUrl: course.bannerImageUrl,
    },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/admin/calendar");
  revalidatePath("/app/calendar");
  revalidatePath("/admin/notifications");
  if (existing) redirect("/admin/courses?saved=1");
}

function inputDate(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  return parts.replace(" ", "T");
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const canWrite = hasPermission(session?.roles ?? [], "courses:write");

  // Garante que os cursos predefinidos da trilha obrigatória existam
  await ensureRequiredCourses();

  const courses = await prisma.course.findMany({
    orderBy: { startsAt: "desc" },
    take: 50,
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const editingCourse = canWrite && query.edit ? await prisma.course.findUnique({ where: { id: query.edit } }) : null;

  return (
    <div className="space-y-6">
      {query.saved ? <p role="status" className="rounded-xl border border-border bg-muted/20 p-3 text-sm">Curso atualizado com sucesso.</p> : null}
      {query.error ? <p role="alert" className="rounded-xl border border-destructive p-3 text-sm">{query.error === "missing" ? "Curso não encontrado." : "Confira os dados do curso e as datas informadas."}</p> : null}
      <div>
        <div className="text-xl font-semibold tracking-tight">Cursos</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Cadastre cursos, defina o público liberado e publique automaticamente na agenda.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Cursos cadastrados</div>
            <div className="text-xs text-muted-foreground">{courses.length} exibidos</div>
          </div>
          <div className="mt-4 divide-y divide-border">
            {courses.length ? (
              courses.map((course) => (
                <div key={course.id} className="py-4">
                  {course.bannerImageUrl ? (
                    <div className="mb-4 overflow-hidden rounded-3xl border border-border/70 bg-muted/10">
                      <div className="relative aspect-[3/1] w-full">
                        <Image
                          src={course.bannerImageUrl}
                          alt={course.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1280px) 100vw, 800px"
                          unoptimized
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{course.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(course.startsAt)}
                        {course.endsAt
                          ? ` até ${new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(course.endsAt)}`
                          : ""}
                        {course.location ? ` • ${course.location}` : ""}
                      </div>
                      {course.description ? (
                        <div className="mt-2 text-sm text-muted-foreground">{course.description}</div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge>{audienceLabel[course.audience]}</Badge>
                        {course.agendaVisible ? <Badge>AGENDA</Badge> : <Badge className="opacity-60">OCULTO</Badge>}
                        {course.isRequired ? (
                          <Badge className="bg-[rgba(76,217,123,0.15)]">TRILHA OBRIGATÓRIA #{course.trackOrder ?? "—"}</Badge>
                        ) : null}
                        {course.notifyAdmins ? <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">ADMINS</Badge> : null}
                        {course.notifyMembers ? <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">MEMBROS</Badge> : null}
                        {course.notifyVolunteers ? (
                          <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">VOLUNTÁRIOS</Badge>
                        ) : null}
                        {course.notifyVisitors ? (
                          <Badge className="bg-[rgba(var(--brand-rgb),0.10)]">VISITANTES</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {canWrite ? <Link href={`/admin/courses?edit=${course.id}#course-form`} className="mb-3 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/20">Editar curso</Link> : null}
                      <div>{course.instructorName ? `Instrutor: ${course.instructorName}` : "Sem instrutor"}</div>
                      <div className="mt-1">
                        Criado por {course.createdBy?.name ?? course.createdBy?.email ?? "Sistema"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                Nenhum curso cadastrado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div id="course-form" className="scroll-mt-24 text-sm font-medium">{editingCourse ? "Editar curso" : "Novo curso"}</div>
          {canWrite ? (
            <form key={editingCourse?.id ?? "new"} action={saveCourse} className="mt-4 space-y-3">
              <input type="hidden" name="courseId" value={editingCourse?.id ?? ""} />
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Título</div>
                <Input name="title" defaultValue={editingCourse?.title ?? ""} placeholder="Ex: Curso de Integração" required />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Descrição curta</div>
                <textarea
                  name="description" defaultValue={editingCourse?.description ?? ""}
                  className="min-h-24 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Resumo do curso"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Detalhes</div>
                <textarea
                  name="details" defaultValue={editingCourse?.details ?? ""}
                  className="min-h-28 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Conteúdo, observações e requisitos"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Instrutor</div>
                <Input name="instructorName" defaultValue={editingCourse?.instructorName ?? ""} placeholder="Nome do responsável" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Início</div>
                  <Input name="startsAt" defaultValue={inputDate(editingCourse?.startsAt)} type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Fim</div>
                  <Input name="endsAt" defaultValue={inputDate(editingCourse?.endsAt)} type="datetime-local" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Local</div>
                <Input name="location" defaultValue={editingCourse?.location ?? ""} placeholder="Ex: Sala 02" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Banner (horizontal)</div>
                <input
                  type="file"
                  name="bannerFile"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-muted/30 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground hover:file:bg-muted/40"
                />
                <Input name="bannerImageUrl" defaultValue={editingCourse?.bannerImageUrl ?? ""} placeholder="Ou cole uma URL de imagem (opcional)" />
                <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                  <div className="text-xs text-muted-foreground">
                    Recomendado: banner horizontal (ex: 1200×400 ou 3:1).
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Liberar para</div>
                <select
                  name="audience"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  defaultValue={editingCourse?.audience ?? "BOTH"}
                >
                  <option value="MEMBERS">Somente membros</option>
                  <option value="VOLUNTEERS">Somente voluntários</option>
                  <option value="BOTH">Membros e voluntários</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Publicação</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="agendaVisible" defaultChecked={editingCourse?.agendaVisible ?? true} className="size-4" />
                  <span>Exibir na agenda após o lançamento</span>
                </label>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Trilha obrigatória</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isRequired" defaultChecked={editingCourse?.isRequired ?? false} className="size-4" />
                  <span>Faz parte da Trilha Obrigatória</span>
                </label>
                <div className="mt-1">
                  <Input name="trackOrder" defaultValue={editingCourse?.trackOrder ?? ""} type="number" min={1} placeholder="Ordem na trilha (ex: 4)" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Notificar públicos</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyMembers" defaultChecked={editingCourse?.notifyMembers ?? false} className="size-4" />
                  <span>Membros</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyAdmins" defaultChecked={editingCourse?.notifyAdmins ?? false} className="size-4" />
                  <span>Administradores</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyVolunteers" defaultChecked={editingCourse?.notifyVolunteers ?? false} className="size-4" />
                  <span>Voluntários</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyVisitors" defaultChecked={editingCourse?.notifyVisitors ?? false} className="size-4" />
                  <span>Visitantes</span>
                </label>
              </div>
              <Button className="w-full" type="submit">
                {editingCourse ? "Salvar alterações" : "Lançar curso"}
              </Button>
              {editingCourse ? <Link href="/admin/courses" className="block rounded-xl border border-border p-3 text-center text-sm">Cancelar edição</Link> : null}
            </form>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Você tem acesso de leitura aos cursos, mas não possui permissão para cadastrar novos.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
