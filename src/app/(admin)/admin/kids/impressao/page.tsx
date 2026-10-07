import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { getKidsPrintConfig, KIDS_PRINT_JOB_STATUS } from "@/server/kids-print";
import type { KidsLabelPayload } from "@/server/kids-print";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KidsSubNav } from "../KidsSubNav";
import { KidsPrintAgent } from "./KidsPrintAgent";
import { KidsPrintConfigForm } from "./KidsPrintConfigForm";
import { cancelKidsPrintJob, retryKidsPrintJob } from "./actions";

export const dynamic = "force-dynamic";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
});

const STATUS_LABEL: Record<string, string> = {
  [KIDS_PRINT_JOB_STATUS.PENDING]: "Na fila",
  [KIDS_PRINT_JOB_STATUS.PRINTED]: "Impressa",
  [KIDS_PRINT_JOB_STATUS.FAILED]: "Falha",
  [KIDS_PRINT_JOB_STATUS.CANCELLED]: "Cancelada",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  [KIDS_PRINT_JOB_STATUS.PENDING]:
    "border border-amber-500/40 bg-amber-500/15 text-amber-100",
  [KIDS_PRINT_JOB_STATUS.PRINTED]:
    "border border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  [KIDS_PRINT_JOB_STATUS.FAILED]:
    "border border-red-500/40 bg-red-500/15 text-red-200",
  [KIDS_PRINT_JOB_STATUS.CANCELLED]: "border border-border bg-muted/20",
};

export default async function KidsImpressaoPage() {
  const session = await getServerSession(authOptions);
  const canWrite = hasPermission((session?.roles ?? []) as RoleKey[], "kids:write");

  const [config, recentJobs, pendingCount] = await Promise.all([
    getKidsPrintConfig(),
    prisma.kidsPrintJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { child: { select: { fullName: true } } },
    }),
    prisma.kidsPrintJob.count({ where: { status: KIDS_PRINT_JOB_STATUS.PENDING } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Ministério Infantil</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Impressão automática das etiquetas de check-in (criança + responsável).
        </div>
      </div>

      <KidsSubNav />

      {!config.enabled ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A impressão automática está desativada. Novos check-ins não geram
          etiquetas até que seja reativada abaixo.
        </div>
      ) : null}

      {canWrite ? (
        <>
          <KidsPrintAgent />
          <KidsPrintConfigForm config={config} />
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Você pode acompanhar as etiquetas abaixo, mas somente voluntários com
          permissão de escrita no Kids podem configurar a impressão ou operar o
          agente.
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Etiquetas recentes</div>
          <Badge>{pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {recentJobs.length ? (
            recentJobs.map((job) => {
              const payload = job.payload as unknown as KidsLabelPayload;
              return (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {payload?.childName ?? job.child.fullName}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {job.labelType === "CHILD" ? "Etiqueta da criança" : "Etiqueta do responsável"}
                      {" • cód. "}
                      {payload?.pickupCode ?? "—"}
                      {job.copies > 1 ? ` • ${job.copies} cópias` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Gerada em {dateTimeFmt.format(job.createdAt)}
                      {job.printedAt ? ` • impressa em ${dateTimeFmt.format(job.printedAt)}` : ""}
                    </div>
                    {job.error ? (
                      <div className="mt-1 text-xs text-red-300">{job.error}</div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className={STATUS_BADGE_CLASS[job.status] ?? ""}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                    {canWrite && job.status !== KIDS_PRINT_JOB_STATUS.PENDING ? (
                      <form action={retryKidsPrintJob}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Reimprimir
                        </Button>
                      </form>
                    ) : null}
                    {canWrite && job.status === KIDS_PRINT_JOB_STATUS.PENDING ? (
                      <form action={cancelKidsPrintJob}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Cancelar
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhuma etiqueta gerada ainda. As etiquetas aparecem aqui assim
              que um check-in for confirmado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
