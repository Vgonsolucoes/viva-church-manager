import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SafeAvatarImage } from "@/components/ui/SafeAvatarImage";
import { KidsSubNav } from "../KidsSubNav";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ageLabel(birthDate: Date | null): string | null {
  if (!birthDate) return null;
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    now.getMonth() < birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
  if (beforeBirthday) years -= 1;
  if (years < 0) return null;
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}

export default async function KidsCriancasPage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await props.searchParams;
  const query = (q ?? "").trim();

  const session = await getServerSession(authOptions);
  // Dados médicos/sensíveis apenas para a equipe do Ministério Infantil.
  const canSeeSensitive = hasPermission((session?.roles ?? []) as RoleKey[], "kids:write");

  const children = await prisma.child.findMany({
    where: query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { guardians: { some: { fullName: { contains: query, mode: "insensitive" } } } },
            { guardians: { some: { phone: { contains: query } } } },
          ],
        }
      : undefined,
    include: {
      guardians: { select: { fullName: true, phone: true, relationship: true } },
      checkins: { orderBy: { checkInAt: "desc" }, take: 1, select: { checkInAt: true } },
    },
    orderBy: { fullName: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Ministério Infantil</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Todas as crianças cadastradas no Ministério Infantil.
        </div>
      </div>

      <KidsSubNav />

      <form className="flex gap-3" action="/admin/kids/criancas" method="get">
        <div className="flex-1">
          <Input
            name="q"
            placeholder="Buscar por nome da criança, responsável ou telefone WhatsApp..."
            defaultValue={query}
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Crianças</div>
          <div className="text-xs text-muted-foreground">
            {children.length} {children.length === 1 ? "registro" : "registros"}
            {children.length === 100 ? " (primeiros 100)" : ""}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {children.length ? (
            children.map((child) => {
              const guardian = child.guardians[0] ?? null;
              const age = ageLabel(child.birthDate);
              const lastCheckIn = child.checkins[0]?.checkInAt ?? null;
              return (
                <div
                  key={child.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {child.photoUrl ? (
                      <SafeAvatarImage
                        src={child.photoUrl}
                        alt={child.fullName}
                        className="h-11 w-11 rounded-full object-cover"
                        fallback={
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {initialsOf(child.fullName)}
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {initialsOf(child.fullName)}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold">{child.fullName}</div>
                        {age ? <Badge>{age}</Badge> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Responsável: {guardian?.fullName ?? "não informado"}
                        {guardian?.phone ? ` • ${guardian.phone}` : ""}
                      </div>
                      {canSeeSensitive && child.allergies ? (
                        <div className="text-xs text-amber-200/90">
                          Alergias: {child.allergies}
                        </div>
                      ) : null}
                      {canSeeSensitive && child.specialNeeds ? (
                        <div className="text-xs text-amber-200/90">
                          Necessidades especiais: {child.specialNeeds}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        Último check-in:{" "}
                        {lastCheckIn ? dateFmt.format(lastCheckIn) : "nunca"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">
              {query
                ? "Nenhuma criança encontrada para a busca informada."
                : "Nenhuma criança cadastrada ainda."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
