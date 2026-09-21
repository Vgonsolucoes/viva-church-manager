import { revalidatePath } from "next/cache";
import Image from "next/image";
import type { MemberType } from "@/generated/prisma/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/server/db";
import {
  safeImageSrc,
  safeImageSrcOrUndefined,
} from "@/lib/safe-image-src";
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

export default async function MembersPage(props: { searchParams?: Promise<Record<string, string | string[]>> }) {
  try {
    const searchParams = props.searchParams ? await props.searchParams : {};
    const editIdRaw = searchParams?.edit;
    const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
    const membersRaw = await prisma.member.findMany({
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

    const members = membersRaw.map((m) => ({ ...m, photoUrl: safeImageSrc(m.photoUrl) }));

    const ministries = await prisma.ministry.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const editMemberRaw = editId
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

    const editMember = editMemberRaw
      ? { ...editMemberRaw, photoUrl: safeImageSrc(editMemberRaw.photoUrl) }
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
  } catch (err) {
    console.error("[members] MembersPage SSR render falhou:", err);
    return (
      <div className="space-y-6">
        <div>
          <div className="text-xl font-semibold tracking-tight">Membros</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Cadastro, histórico e acompanhamento.
          </div>
        </div>
        <Card className="p-5">
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">
            Não foi possível carregar os membros no momento.
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Atualize a página ou verifique a conexão com o banco de dados e permissões de upload.
            Tente novamente em instantes.
          </div>
        </Card>
      </div>
    );
  }
}
