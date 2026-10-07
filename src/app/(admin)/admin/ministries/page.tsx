import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SafeAvatarImage } from "@/components/ui/SafeAvatarImage";
import { prisma } from "@/server/db";
import { safeImageSrc, safeImageSrcOrUndefined } from "@/lib/safe-image-src";
import { MinistryFormClient } from "./MinistryFormClient";
import type { LeaderPickerMember } from "./LeaderPicker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export default async function MinistriesPage(props: {
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const editIdRaw = searchParams?.edit;
  const editId = (Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw) ?? null;

  const [ministries, membersRaw, editMinistry] = await Promise.all([
    prisma.ministry.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        leader: { select: { id: true, fullName: true, email: true, photoUrl: true } },
        _count: { select: { volunteers: true, members: true, schedules: true } },
      },
    }),
    prisma.member.findMany({
      orderBy: { fullName: "asc" },
      take: 500,
      select: { id: true, fullName: true, email: true, photoUrl: true },
    }),
    editId
      ? prisma.ministry.findUnique({
          where: { id: editId },
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
            leaderId: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const pickerMembers: LeaderPickerMember[] = membersRaw.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    email: m.email,
    photoUrl: safeImageSrc(m.photoUrl),
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Ministérios</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Organização por equipes, escalas e responsabilidades.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="text-sm font-semibold">Ministérios cadastrados</div>
            <div className="text-xs text-muted-foreground">{ministries.length} no total</div>
          </div>
          <div className="space-y-2 px-6 pb-6 pt-4">
            {ministries.length ? (
              ministries.map((m) => {
                const leaderPhoto = m.leader ? safeImageSrcOrUndefined(m.leader.photoUrl) : undefined;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-3xl border border-border/80 bg-muted/10 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{m.name}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {m.description ?? "Sem descrição"}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {m.leader ? (
                          <>
                            {leaderPhoto ? (
                              <SafeAvatarImage
                                src={leaderPhoto}
                                alt={m.leader.fullName}
                                className="size-6 rounded-full object-cover"
                                fallback={
                                  <div className="flex size-6 items-center justify-center rounded-full bg-muted/30 text-[9px] font-semibold uppercase text-muted-foreground">
                                    {initialsOf(m.leader.fullName)}
                                  </div>
                                }
                              />
                            ) : (
                              <div className="flex size-6 items-center justify-center rounded-full bg-muted/30 text-[9px] font-semibold uppercase text-muted-foreground">
                                {initialsOf(m.leader.fullName)}
                              </div>
                            )}
                            <span className="truncate text-xs text-foreground">
                              Líder: {m.leader.fullName}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            Líder não definido
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Badge className="bg-muted/10">{m._count.members} membros</Badge>
                      <Badge className="bg-muted/10">{m._count.volunteers} voluntários</Badge>
                      <Badge className="bg-muted/10">{m._count.schedules} escalas</Badge>
                      {m.active ? (
                        <Badge className="border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.10)] text-foreground">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.10)] text-foreground">
                          Inativo
                        </Badge>
                      )}
                      <a
                        href={`/admin/ministries?edit=${m.id}`}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Editar
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum ministério cadastrado.</div>
            )}
          </div>
        </Card>

        <Card>
          <div className="px-6 pt-6">
            <div className="text-sm font-semibold">Novo ministério</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Crie um ministério para vincular membros, voluntários e escalas.
            </div>
          </div>
          <div className="px-6 pb-6 pt-4">
            <MinistryFormClient submitLabel="Criar ministério" members={pickerMembers} />
          </div>
        </Card>
      </div>

      {editMinistry ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar ministério"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
        >
          <a href="/admin/ministries" aria-label="Fechar edição" className="absolute inset-0 cursor-default" />
          <Card className="relative z-10 w-full max-w-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">Editar ministério</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{editMinistry.name}</div>
              </div>
              <a
                href="/admin/ministries"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                aria-label="Fechar"
                title="Fechar"
              >
                ✕
              </a>
            </div>
            <div className="mt-4 max-h-[75vh] overflow-y-auto pr-1">
              <MinistryFormClient
                submitLabel="Salvar alterações"
                members={pickerMembers}
                defaultValues={{
                  ministryId: editMinistry.id,
                  name: editMinistry.name,
                  description: editMinistry.description,
                  active: editMinistry.active,
                  leaderId: editMinistry.leaderId,
                }}
              />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
