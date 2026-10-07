import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { MemberType } from "@/generated/prisma/client";
import { authOptions } from "@/server/auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SafeAvatarImage } from "@/components/ui/SafeAvatarImage";
import { prisma } from "@/server/db";
import {
  safeImageSrc,
  safeImageSrcOrUndefined,
} from "@/lib/safe-image-src";
import { MembersFormClient } from "./MembersFormClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const memberTypeOptions = [
  { value: "MEMBER", label: "Membro" },
  { value: "VISITOR", label: "Visitante" },
  { value: "NEW_MEMBER", label: "Novo membro" },
  { value: "LEADER", label: "Líder" },
  { value: "VOLUNTEER", label: "Voluntário" },
  { value: "DISCIPLER", label: "Discipulador" },
  { value: "PASTOR", label: "Pastor" },
] as const;

const memberTypeLabels = Object.fromEntries(
  memberTypeOptions.map((option) => [option.value, option.label]),
) as Record<(typeof memberTypeOptions)[number]["value"], string>;

export default async function MembersPage(props: { searchParams?: Promise<Record<string, string | string[]>> }) {
  try {
    const session = await getServerSession(authOptions);
    const canManageSuperAdmin = ((session?.roles ?? []) as string[]).includes("SUPER_ADMIN");
    const searchParams = props.searchParams ? await props.searchParams : {};
    const editIdRaw = searchParams?.edit;
    const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
    let membersRaw: Array<{
      id: string;
      fullName: string;
      photoUrl: string | null;
      cpf: string | null;
      email: string | null;
      phone: string | null;
      type: MemberType;
      types: MemberType[] | null;
      city: string | null;
      state: string | null;
      baptized: boolean;
      baptismYear: number | null;
      conversionYear: number | null;
      ministry: { name: string } | null;
      memberMinistries: Array<{ ministry: { name: string } }>;
    }> = [];
    try {
      membersRaw = await prisma.member.findMany({
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
    } catch (err) {
      console.error("[members] prisma.member.findMany falhou:", err);
      membersRaw = [];
    }

    const members = membersRaw.map((m) => {
      try {
        return { ...m, photoUrl: safeImageSrc(m.photoUrl) };
      } catch {
        return { ...m, photoUrl: null };
      }
    });

    let ministries: Array<{ id: string; name: string }> = [];
    try {
      ministries = await prisma.ministry.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    } catch (err) {
      console.error("[members] prisma.ministry.findMany falhou:", err);
      ministries = [];
    }

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
            user: { select: { id: true, email: true, roles: { select: { role: true } } } },
          },
        }).catch((err) => {
          console.error("[members] prisma.member.findUnique(edit) falhou:", err);
          return null;
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
              members.map((m) => {
                try {
                  const safePhoto = safeImageSrcOrUndefined(m.photoUrl);
                  const initials = m.fullName.slice(0, 2).toUpperCase();
                  const displayTypes = (m.types?.length ? m.types : [m.type]) ?? [m.type];
                  const ministriesText = m.memberMinistries.length
                    ? ` • ${m.memberMinistries.map((mm) => mm.ministry.name).join(", ")}`
                    : m.ministry?.name
                      ? ` • ${m.ministry.name}`
                      : "";
                  const subParts: string[] = [];
                  if (m.cpf) subParts.push(`CPF ${m.cpf}`);
                  subParts.push(m.email ?? "—");
                  if (m.phone) subParts.push(m.phone);
                  const location = [m.city, m.state].filter(Boolean).join(" - ");
                  if (location) subParts.push(location);
                  const subtitle = `${subParts.slice(0, 3).join(" • ")}${ministriesText}`;
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/10">
                          {safePhoto ? (
                            <SafeAvatarImage
                              src={safePhoto}
                              alt={m.fullName}
                              className="size-full object-cover"
                              fallback={
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {initials}
                                </div>
                              }
                            />
                          ) : (
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {initials}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{m.fullName}</div>
                          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {displayTypes.map((type) => (
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
                  );
                } catch (memberErr) {
                  console.error("[members] render card do membro falhou (id=%s):", m.id, memberErr);
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{m.fullName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Não foi possível exibir este membro no momento.
                        </div>
                      </div>
                      <a
                        href={`/admin/members?edit=${m.id}`}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Editar
                      </a>
                    </div>
                  );
                }
              })
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                Nenhum membro cadastrado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <MembersFormClient
            title="Novo cadastro"
            submitLabel="Cadastrar"
            ministries={ministries}
            canManageSuperAdmin={canManageSuperAdmin}
          />
        </Card>
      </div>

      {editMember ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar cadastro de membro"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
        >
          <a
            href="/admin/members"
            aria-label="Fechar edição"
            className="absolute inset-0 cursor-default"
          />
          <Card className="relative z-10 w-full max-w-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">Editar cadastro</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{editMember.fullName}</div>
              </div>
              <a
                href="/admin/members"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                aria-label="Fechar"
                title="Fechar"
              >
                ✕
              </a>
            </div>
            <div className="mt-4 max-h-[75vh] overflow-y-auto pr-1">
              <MembersFormClient
                title="Dados do membro"
                submitLabel="Salvar alterações"
                ministries={ministries}
                canManageSuperAdmin={canManageSuperAdmin}
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
                  isSuperAdmin: editMember.user?.roles.some((r) => r.role === "SUPER_ADMIN") ?? false,
                  loginEmail: editMember.user?.email ?? null,
                }}
              />
            </div>
          </Card>
        </div>
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
