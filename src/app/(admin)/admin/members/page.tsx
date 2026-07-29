import { revalidatePath } from "next/cache";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { MemberType } from "@/generated/prisma/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { saveMemberAvatarUpload } from "@/server/uploads";
import { MembersFormClient } from "./MembersFormClient";

export const dynamic = "force-dynamic";

const memberTypeOptions = [
  { value: "MEMBER", label: "Membro" },
  { value: "VISITOR", label: "Visitante" },
  { value: "NEW_MEMBER", label: "Novo membro" },
  { value: "LEADER", label: "Líder" },
  { value: "VOLUNTEER", label: "Voluntário" },
  { value: "DISCIPLER", label: "Discipulador" },
] as const;

const memberTypeLabels = Object.fromEntries(
  memberTypeOptions.map((option) => [option.value, option.label]),
) as Record<(typeof memberTypeOptions)[number]["value"], string>;

const currentYear = new Date().getFullYear();

const yearField = z.preprocess((value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return n;
}, z.number().int().min(1900).max(currentYear).optional());

const cpfField = z.preprocess((value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  return digits;
}, z.string().length(11).optional());

const createMemberSchema = z.object({
  fullName: z.string().min(2),
  cpf: cpfField,
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  ministryIds: z.array(z.string()).optional(),
  types: z
    .array(z.enum(["MEMBER", "VISITOR", "NEW_MEMBER", "LEADER", "VOLUNTEER", "DISCIPLER"]))
    .min(1),
  zip: z.string().optional().or(z.literal("")),
  addressLine1: z.string().optional().or(z.literal("")),
  addressLine2: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  baptized: z.boolean().optional(),
  baptismYear: yearField,
  conversionYear: yearField,
});

function getSelectedTypes(types: MemberType[]) {
  const unique = Array.from(new Set(types));
  return unique.length ? unique : (["MEMBER"] as MemberType[]);
}

function getPrimaryType(types: MemberType[]) {
  if (types.includes("MEMBER")) return "MEMBER";
  return types[0] ?? "MEMBER";
}

async function createMember(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    cpf: formData.get("cpf"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    ministryIds: formData.getAll("ministryIds").map((value) => String(value)),
    types: formData.getAll("types").map((value) => String(value)),
    zip: formData.get("zip"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    baptized: formData.get("baptized") === "on",
    baptismYear: formData.get("baptismYear"),
    conversionYear: formData.get("conversionYear"),
  });

  if (!parsed.success) return;

  const photoFile = formData.get("photoFile");
  let uploadedPhotoUrl: string | null = null;
  try {
    const file = photoFile as unknown as File | null;
    if (
      file &&
      typeof file === "object" &&
      typeof (file as { name?: unknown }).name === "string" &&
      (file as File).name.length > 0 &&
      typeof (file as { size?: unknown }).size === "number" &&
      (file as File).size > 0
    ) {
      uploadedPhotoUrl = await saveMemberAvatarUpload(file as File);
    }
  } catch (err) {
    console.error("[members] Falha ao salvar foto de perfil:", err);
    uploadedPhotoUrl = null;
  }

  const selectedTypes = getSelectedTypes(parsed.data.types);
  const primaryType = getPrimaryType(selectedTypes);
  const normalizedCpf = parsed.data.cpf ?? null;
  const baptized = Boolean(parsed.data.baptized);
  const ministryIds = Array.from(
    new Set((parsed.data.ministryIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
  );
  const validMinistries = ministryIds.length
    ? await prisma.ministry.findMany({
        where: { id: { in: ministryIds }, active: true },
        select: { id: true },
      })
    : [];
  const validMinistryIds = validMinistries.map((m) => m.id);

  if (normalizedCpf) {
    const existingByCpf = await prisma.member.findUnique({
      where: { cpf: normalizedCpf },
      select: { id: true },
    });
    if (existingByCpf) return;
  }

  const member = await prisma.member.create({
    data: {
      fullName: parsed.data.fullName,
      photoUrl: uploadedPhotoUrl,
      cpf: normalizedCpf,
      email: parsed.data.email ? parsed.data.email.toLowerCase().trim() : null,
      phone: parsed.data.phone ? String(parsed.data.phone).trim() : null,
      type: primaryType,
      types: selectedTypes,
      ministryId: validMinistryIds[0] ?? null,
      memberMinistries: validMinistryIds.length
        ? { createMany: { data: validMinistryIds.map((ministryId) => ({ ministryId })) } }
        : undefined,
      zip: parsed.data.zip ? String(parsed.data.zip).trim() : null,
      addressLine1: parsed.data.addressLine1 ? String(parsed.data.addressLine1).trim() : null,
      addressLine2: parsed.data.addressLine2 ? String(parsed.data.addressLine2).trim() : null,
      neighborhood: parsed.data.neighborhood ? String(parsed.data.neighborhood).trim() : null,
      city: parsed.data.city ? String(parsed.data.city).trim() : null,
      state: parsed.data.state ? String(parsed.data.state).trim().toUpperCase().slice(0, 2) : null,
      baptized,
      baptismYear: baptized ? parsed.data.baptismYear ?? null : null,
      conversionYear: parsed.data.conversionYear ?? null,
    },
  });

  if (member.email && member.photoUrl) {
    await prisma.user.updateMany({
      where: {
        OR: [{ email: member.email }, { memberId: member.id }],
      },
      data: { imageUrl: member.photoUrl },
    });
  } else if (member.id) {
    await prisma.user.updateMany({
      where: { memberId: member.id, imageUrl: null },
      data: { imageUrl: null },
    });
  }

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Member",
    entityId: member.id,
    after: {
      id: member.id,
      fullName: member.fullName,
      photoUrl: member.photoUrl,
      cpf: member.cpf,
      email: member.email,
      type: member.type,
      types: member.types,
      ministryId: member.ministryId,
      zip: member.zip,
      city: member.city,
      state: member.state,
      baptized: member.baptized,
      baptismYear: member.baptismYear,
      conversionYear: member.conversionYear,
    },
  });

  revalidatePath("/admin/members");
}

const updateMemberSchema = createMemberSchema.extend({
  memberId: z.string().min(1),
});

async function updateMember(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = updateMemberSchema.safeParse({
    memberId: formData.get("memberId"),
    fullName: formData.get("fullName"),
    cpf: formData.get("cpf"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    ministryIds: formData.getAll("ministryIds").map((value) => String(value)),
    types: formData.getAll("types").map((value) => String(value)),
    zip: formData.get("zip"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    baptized: formData.get("baptized") === "on",
    baptismYear: formData.get("baptismYear"),
    conversionYear: formData.get("conversionYear"),
  });

  if (!parsed.success) return;

  const photoFile = formData.get("photoFile");
  let uploadedPhotoUrl: string | null = null;
  try {
    const file = photoFile as unknown as File | null;
    if (
      file &&
      typeof file === "object" &&
      typeof (file as { name?: unknown }).name === "string" &&
      (file as File).name.length > 0 &&
      typeof (file as { size?: unknown }).size === "number" &&
      (file as File).size > 0
    ) {
      uploadedPhotoUrl = await saveMemberAvatarUpload(file as File);
    }
  } catch (err) {
    console.error("[members] Falha ao salvar foto de perfil:", err);
    uploadedPhotoUrl = null;
  }

  const selectedTypes = getSelectedTypes(parsed.data.types);
  const primaryType = getPrimaryType(selectedTypes);
  const normalizedCpf = parsed.data.cpf ?? null;
  const baptized = Boolean(parsed.data.baptized);
  const ministryIds = Array.from(
    new Set((parsed.data.ministryIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
  );
  const validMinistries = ministryIds.length
    ? await prisma.ministry.findMany({
        where: { id: { in: ministryIds }, active: true },
        select: { id: true },
      })
    : [];
  const validMinistryIds = validMinistries.map((m) => m.id);

  const before = await prisma.member.findUnique({
    where: { id: parsed.data.memberId },
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      cpf: true,
      email: true,
      phone: true,
      type: true,
      types: true,
      zip: true,
      addressLine1: true,
      addressLine2: true,
      neighborhood: true,
      city: true,
      state: true,
      baptized: true,
      baptismYear: true,
      conversionYear: true,
    },
  });

  if (!before) return;

  if (normalizedCpf) {
    const existingByCpf = await prisma.member.findUnique({
      where: { cpf: normalizedCpf },
      select: { id: true },
    });
    if (existingByCpf && existingByCpf.id !== before.id) return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.memberMinistry.deleteMany({ where: { memberId: before.id } });
    const updatedMember = await tx.member.update({
      where: { id: before.id },
      data: {
        fullName: parsed.data.fullName,
        photoUrl: uploadedPhotoUrl ?? before.photoUrl,
        cpf: normalizedCpf,
        email: parsed.data.email ? parsed.data.email.toLowerCase().trim() : null,
        phone: parsed.data.phone ? String(parsed.data.phone).trim() : null,
        type: primaryType,
        types: selectedTypes,
        ministryId: validMinistryIds[0] ?? null,
        memberMinistries: validMinistryIds.length
          ? { createMany: { data: validMinistryIds.map((ministryId) => ({ ministryId })) } }
          : undefined,
        zip: parsed.data.zip ? String(parsed.data.zip).trim() : null,
        addressLine1: parsed.data.addressLine1 ? String(parsed.data.addressLine1).trim() : null,
        addressLine2: parsed.data.addressLine2 ? String(parsed.data.addressLine2).trim() : null,
        neighborhood: parsed.data.neighborhood ? String(parsed.data.neighborhood).trim() : null,
        city: parsed.data.city ? String(parsed.data.city).trim() : null,
        state: parsed.data.state ? String(parsed.data.state).trim().toUpperCase().slice(0, 2) : null,
        baptized,
        baptismYear: baptized ? parsed.data.baptismYear ?? null : null,
        conversionYear: parsed.data.conversionYear ?? null,
      },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        cpf: true,
        email: true,
        phone: true,
        type: true,
        types: true,
        zip: true,
        city: true,
        state: true,
        baptized: true,
        baptismYear: true,
        conversionYear: true,
        ministryId: true,
      },
    });

    if (updatedMember.photoUrl) {
      await tx.user.updateMany({
        where: {
          OR: [
            updatedMember.email ? { email: updatedMember.email } : undefined,
            { memberId: updatedMember.id },
          ].filter(Boolean) as Array<{ email: string } | { memberId: string }>,
        },
        data: { imageUrl: updatedMember.photoUrl },
      });
    }

    return updatedMember;
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "UPDATE",
    entityType: "Member",
    entityId: updated.id,
    before: {
      id: before.id,
      fullName: before.fullName,
      photoUrl: before.photoUrl,
      cpf: before.cpf,
      email: before.email,
      type: before.type,
      types: before.types,
      zip: before.zip,
      city: before.city,
      state: before.state,
      baptized: before.baptized,
      baptismYear: before.baptismYear,
      conversionYear: before.conversionYear,
    },
    after: updated,
  });

  revalidatePath("/admin/members");
}

export default async function MembersPage(props: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const editIdRaw = searchParams?.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      cpf: true,
      email: true,
      phone: true,
      type: true,
      types: true,
      city: true,
      state: true,
      baptized: true,
      baptismYear: true,
      conversionYear: true,
      ministry: { select: { name: true } },
      memberMinistries: { select: { ministry: { select: { name: true } } } },
    },
  });

  const ministries = await prisma.ministry.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const editMember = editId
    ? await prisma.member.findUnique({
        where: { id: editId },
        select: {
          id: true,
          fullName: true,
          photoUrl: true,
          cpf: true,
          email: true,
          phone: true,
          type: true,
          types: true,
          zip: true,
          addressLine1: true,
          addressLine2: true,
          neighborhood: true,
          city: true,
          state: true,
          baptized: true,
          baptismYear: true,
          conversionYear: true,
          ministryId: true,
          memberMinistries: { select: { ministryId: true } },
        },
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Membros</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Cadastro, histórico e acompanhamento.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Últimos cadastrados</div>
            <div className="text-xs text-muted-foreground">{members.length} exibidos</div>
          </div>
          <div className="mt-4 divide-y divide-border">
            {members.length ? (
              members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/10">
                      {m.photoUrl ? (
                        <Image
                          src={m.photoUrl}
                          alt={m.fullName}
                          width={44}
                          height={44}
                          className="size-full object-cover"
                          unoptimized
                          loader={({ src }) => src}
                        />
                      ) : (
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {m.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{m.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.cpf ? `CPF ${m.cpf} • ` : ""}
                        {m.email ?? "—"} {m.phone ? `• ${m.phone}` : ""}
                        {m.city || m.state ? ` • ${[m.city, m.state].filter(Boolean).join(" - ")}` : ""}
                        {m.memberMinistries.length
                          ? ` • ${m.memberMinistries.map((mm) => mm.ministry.name).join(", ")}`
                          : m.ministry?.name
                            ? ` • ${m.ministry.name}`
                            : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {((m.types?.length ? m.types : [m.type]) ?? [m.type]).map((type) => (
                        <Badge key={`${m.id}-${type}`} className="shrink-0">
                          {memberTypeLabels[type]}
                        </Badge>
                      ))}
                      {m.baptized ? (
                        <Badge className="shrink-0">
                          Batizado{m.baptismYear ? ` • ${m.baptismYear}` : ""}
                        </Badge>
                      ) : (
                        <Badge className="shrink-0">Não batizado</Badge>
                      )}
                    </div>
                    <a
                      href={`/admin/members?edit=${m.id}`}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Editar
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                Nenhum membro cadastrado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <MembersFormClient
            mode="create"
            title="Novo cadastro"
            submitLabel="Cadastrar"
            action={createMember}
            ministries={ministries}
          />
        </Card>
      </div>

      {editMember ? (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">Editar cadastro</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{editMember.fullName}</div>
            </div>
            <a href="/admin/members" className="text-xs font-medium text-muted-foreground hover:underline">
              Cancelar
            </a>
          </div>
          <div className="mt-4">
            <MembersFormClient
              mode="edit"
              title="Dados do membro"
              submitLabel="Salvar alterações"
              action={updateMember}
              ministries={ministries}
              defaultValues={{
                memberId: editMember.id,
                fullName: editMember.fullName,
                photoUrl: editMember.photoUrl,
                cpf: editMember.cpf,
                email: editMember.email,
                phone: editMember.phone,
                ministryIds: editMember.memberMinistries.length
                  ? editMember.memberMinistries.map((mm) => mm.ministryId)
                  : editMember.ministryId
                    ? [editMember.ministryId]
                    : [],
                zip: editMember.zip,
                addressLine1: editMember.addressLine1,
                addressLine2: editMember.addressLine2,
                neighborhood: editMember.neighborhood,
                city: editMember.city,
                state: editMember.state,
                baptized: editMember.baptized,
                baptismYear: editMember.baptismYear,
                conversionYear: editMember.conversionYear,
                types: (editMember.types.length ? editMember.types : [editMember.type]) as MemberType[],
              }}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
