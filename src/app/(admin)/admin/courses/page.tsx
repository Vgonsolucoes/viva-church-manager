import Image from "next/image";
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

export const dynamic = "force-dynamic";

const createCourseSchema = z
  .object({
    title: z.string().min(2),
    description: z.string().optional().or(z.literal("")),
    details: z.string().optional().or(z.literal("")),
    instructorName: z.string().optional().or(z.literal("")),
    startsAt: z.string().min(5),
    endsAt: z.string().optional().or(z.literal("")),
    location: z.string().optional().or(z.literal("")),
    bannerImageUrl: z.string().url().optional().or(z.literal("")),
    audience: z.enum(["MEMBERS", "VOLUNTEERS", "BOTH"]).default("BOTH"),
    agendaVisible: z.string().optional(),
    notifyAdmins: z.string().optional(),
    notifyMembers: z.string().optional(),
    notifyVolunteers: z.string().optional(),
    notifyVisitors: z.string().optional(),
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

async function createCourse(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.roles ?? [], "courses:write")) return;

  const parsed = createCourseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    details: formData.get("details"),
    instructorName: formData.get("instructorName"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location"),
    bannerImageUrl: formData.get("bannerImageUrl"),
    audience: formData.get("audience"),
    agendaVisible: formData.get("agendaVisible"),
    notifyAdmins: formData.get("notifyAdmins"),
    notifyMembers: formData.get("notifyMembers"),
    notifyVolunteers: formData.get("notifyVolunteers"),
    notifyVisitors: formData.get("notifyVisitors"),
  });
  if (!parsed.success) return;

  const bannerFile = formData.get("bannerFile");
  const uploadedBannerUrl = await savePublicImageUpload(bannerFile as unknown as File);
  const bannerImageUrl = uploadedBannerUrl ?? (parsed.data.bannerImageUrl || null);

  const slug = await generateUniqueSlug(parsed.data.title);
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  const notifyAdmins = parsed.data.notifyAdmins === "on";
  const notifyMembers = parsed.data.notifyMembers === "on";
  const notifyVolunteers = parsed.data.notifyVolunteers === "on";
  const notifyVisitors = parsed.data.notifyVisitors === "on";

  const course = await prisma.course.create({
    data: {
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
      notifyAdmins,
      notifyMembers,
      notifyVolunteers,
      notifyVisitors,
      createdById: session.uid,
    },
  });

  const targetRoles = notifyAdmins ? adminRoles : [];
  const targetMemberTypes = Array.from(
    new Set<MemberType>([
      ...(notifyMembers ? memberAudienceTypes : []),
      ...(notifyVolunteers ? (["VOLUNTEER"] as MemberType[]) : []),
      ...(notifyVisitors ? (["VISITOR"] as MemberType[]) : []),
    ]),
  );

  if (targetRoles.length || targetMemberTypes.length) {
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
    action: "CREATE",
    entityType: "Course",
    entityId: course.id,
    after: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      audience: course.audience,
      startsAt: course.startsAt,
      agendaVisible: course.agendaVisible,
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
}

export default async function CoursesPage() {
  const session = await getServerSession(authOptions);
  const canWrite = hasPermission(session?.roles ?? [], "courses:write");

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

  return (
    <div className="space-y-6">
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
                          loader={({ src }) => src}
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
                        {course.notifyAdmins ? <Badge className="bg-[rgba(88,167,255,0.10)]">ADMINS</Badge> : null}
                        {course.notifyMembers ? <Badge className="bg-[rgba(88,167,255,0.10)]">MEMBROS</Badge> : null}
                        {course.notifyVolunteers ? (
                          <Badge className="bg-[rgba(88,167,255,0.10)]">VOLUNTÁRIOS</Badge>
                        ) : null}
                        {course.notifyVisitors ? (
                          <Badge className="bg-[rgba(88,167,255,0.10)]">VISITANTES</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
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
          <div className="text-sm font-medium">Novo curso</div>
          {canWrite ? (
            <form action={createCourse} className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Título</div>
                <Input name="title" placeholder="Ex: Curso de Integração" required />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Descrição curta</div>
                <textarea
                  name="description"
                  className="min-h-24 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Resumo do curso"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Detalhes</div>
                <textarea
                  name="details"
                  className="min-h-28 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Conteúdo, observações e requisitos"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Instrutor</div>
                <Input name="instructorName" placeholder="Nome do responsável" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Início</div>
                  <Input name="startsAt" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Fim</div>
                  <Input name="endsAt" type="datetime-local" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Local</div>
                <Input name="location" placeholder="Ex: Sala 02" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Banner (horizontal)</div>
                <input
                  type="file"
                  name="bannerFile"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-muted/30 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground hover:file:bg-muted/40"
                />
                <Input name="bannerImageUrl" placeholder="Ou cole uma URL de imagem (opcional)" />
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
                  defaultValue="BOTH"
                >
                  <option value="MEMBERS">Somente membros</option>
                  <option value="VOLUNTEERS">Somente voluntários</option>
                  <option value="BOTH">Membros e voluntários</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Publicação</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="agendaVisible" defaultChecked className="size-4" />
                  <span>Exibir na agenda após o lançamento</span>
                </label>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Notificar públicos</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyMembers" className="size-4" />
                  <span>Membros</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyAdmins" className="size-4" />
                  <span>Administradores</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyVolunteers" className="size-4" />
                  <span>Voluntários</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notifyVisitors" className="size-4" />
                  <span>Visitantes</span>
                </label>
              </div>
              <Button className="w-full" type="submit">
                Lançar curso
              </Button>
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
