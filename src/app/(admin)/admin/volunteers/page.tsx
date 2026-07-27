import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const createVolunteerSchema = z.object({
  memberId: z.string().min(1),
  ministryName: z.string().optional().or(z.literal("")),
  availability: z.string().optional().or(z.literal("")),
  skills: z.string().optional().or(z.literal("")),
});

async function createVolunteer(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createVolunteerSchema.safeParse({
    memberId: formData.get("memberId"),
    ministryName: formData.get("ministryName"),
    availability: formData.get("availability"),
    skills: formData.get("skills"),
  });
  if (!parsed.success) return;

  const member = await prisma.member.findUnique({
    where: { id: parsed.data.memberId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      ministryId: true,
      type: true,
      types: true,
    },
  });
  if (!member) return;

  const ministry =
    parsed.data.ministryName && parsed.data.ministryName.trim().length
      ? await prisma.ministry.upsert({
          where: { name: parsed.data.ministryName.trim() },
          update: {},
          create: { name: parsed.data.ministryName.trim() },
        })
      : null;

  const updatedMember = await prisma.member.update({
    where: { id: member.id },
    data: {
      type: "VOLUNTEER",
      types: Array.from(new Set([...(member.types.length ? member.types : [member.type]), "VOLUNTEER"])),
      ministryId: ministry?.id ?? member.ministryId ?? null,
      memberMinistries: ministry?.id
        ? {
            createMany: {
              data: [{ ministryId: ministry.id }],
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  });

  const volunteer = await prisma.volunteerProfile.upsert({
    where: { memberId: member.id },
    update: {
      ministryId: ministry?.id ?? undefined,
      availability: parsed.data.availability ? parsed.data.availability.trim() : null,
      skills: parsed.data.skills
        ? parsed.data.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    },
    create: {
      memberId: member.id,
      ministryId: ministry?.id ?? null,
      availability: parsed.data.availability ? parsed.data.availability.trim() : null,
      skills: parsed.data.skills
        ? parsed.data.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    },
    include: { member: true, ministry: true },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "UPSERT",
    entityType: "VolunteerProfile",
    entityId: volunteer.id,
    after: {
      id: volunteer.id,
      memberId: volunteer.memberId,
      ministryId: volunteer.ministryId,
      memberType: updatedMember.type,
    },
  });

  revalidatePath("/admin/volunteers");
  revalidatePath("/admin/members");
}

export default async function VolunteersPage() {
  const [members, volunteers] = await Promise.all([
    prisma.member.findMany({
      orderBy: { fullName: "asc" },
      take: 500,
      select: { id: true, fullName: true, type: true, types: true },
    }),
    prisma.member.findMany({
      where: {
        OR: [{ types: { has: "VOLUNTEER" } }, { type: "VOLUNTEER" }],
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      include: { ministry: true, volunteerProfile: { include: { ministry: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Voluntários</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Lista automática de membros marcados como voluntários, com detalhes de disponibilidade e habilidades.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Equipe cadastrada</div>
            <div className="text-xs text-muted-foreground">{volunteers.length} exibidos</div>
          </div>
          <div className="mt-4 divide-y divide-border">
            {volunteers.length ? (
              volunteers.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{m.fullName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.volunteerProfile?.ministry?.name ?? m.ministry?.name ?? "Sem ministério"}{" "}
                      {m.phone ? `• ${m.phone}` : ""}
                    </div>
                  </div>
                  <Badge className="shrink-0">
                    {m.volunteerProfile?.skills?.length
                      ? `${m.volunteerProfile.skills.length} skills`
                      : "—"}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                Nenhum voluntário cadastrado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Marcar como voluntário</div>
          <form action={createVolunteer} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Membro</div>
              <select
                name="memberId"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecionar membro
                </option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                    {member.types.includes("VOLUNTEER") || member.type === "VOLUNTEER"
                      ? " • já é voluntário"
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Ministério</div>
              <Input name="ministryName" placeholder="Ex: Louvor" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Disponibilidade</div>
              <Input name="availability" placeholder="Ex: Domingos à noite" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Habilidades</div>
              <Input name="skills" placeholder="Ex: som, projeção, foto (separar por vírgula)" />
            </div>
            <Button className="w-full" type="submit">
              Salvar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
