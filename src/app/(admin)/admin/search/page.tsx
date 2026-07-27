import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function normalizeQuery(q?: string) {
  const v = (q ?? "").trim();
  return v.length ? v : null;
}

export default async function AdminSearchPage(props: {
  searchParams: { q?: string } | Promise<{ q?: string }>;
}) {
  const searchParams = await Promise.resolve(props.searchParams);
  const q = normalizeQuery(searchParams.q);

  if (!q || q.length < 2) {
    return (
      <Card className="p-5">
        <div className="text-sm font-medium">Busca</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Digite pelo menos 2 caracteres no campo de busca.
        </div>
      </Card>
    );
  }

  const [members, volunteers, events, assets] = await Promise.all([
    prisma.member.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { fullName: "asc" },
      take: 10,
    }),
    prisma.volunteerProfile.findMany({
      where: {
        member: {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
      },
      include: { member: true, ministry: true },
      take: 10,
    }),
    prisma.event.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { startsAt: "desc" },
      take: 10,
    }),
    prisma.asset.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold tracking-tight">Busca</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Resultados para{" "}
          <span className="font-semibold text-foreground">&quot;{q}&quot;</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Membros</div>
            <Badge>{members.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {members.length ? (
              members.map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="text-sm font-semibold">{m.fullName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {m.email ?? "—"} {m.phone ? `• ${m.phone}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sem resultados.</div>
            )}
          </div>
          <div className="mt-4 text-xs">
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/members">
              Abrir módulo de membros
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Voluntários</div>
            <Badge>{volunteers.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {volunteers.length ? (
              volunteers.map((v) => (
                <div key={v.id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="text-sm font-semibold">{v.member.fullName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {v.ministry?.name ?? "Sem ministério"}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sem resultados.</div>
            )}
          </div>
          <div className="mt-4 text-xs">
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/volunteers">
              Abrir módulo de voluntários
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Eventos</div>
            <Badge>{events.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {events.length ? (
              events.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="text-sm font-semibold">{e.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(e.startsAt)}
                    {e.location ? ` • ${e.location}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sem resultados.</div>
            )}
          </div>
          <div className="mt-4 text-xs">
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/events">
              Abrir módulo de eventos
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Patrimônio</div>
            <Badge>{assets.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {assets.length ? (
              assets.map((a) => (
                <div key={a.id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="text-sm font-semibold">
                    {a.name} <span className="text-muted-foreground">•</span>{" "}
                    <span className="font-mono text-xs">{a.code}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.category ?? "Sem categoria"}
                    {a.location ? ` • ${a.location}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sem resultados.</div>
            )}
          </div>
          <div className="mt-4 text-xs">
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/assets">
              Abrir módulo de patrimônio
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
