import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { getActiveKidsService, NO_ACTIVE_SERVICE_MESSAGE } from "@/server/kids-services";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { KidsSubNav } from "../KidsSubNav";
import { KidsServiceManager } from "./KidsServiceManager";

export const dynamic = "force-dynamic";

export default async function KidsHorariosPage() {
  const session = await getServerSession(authOptions);
  const canWrite = hasPermission((session?.roles ?? []) as RoleKey[], "kids:write");

  const [services, activeResult] = await Promise.all([
    prisma.kidsServiceSchedule.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    getActiveKidsService(),
  ]);

  const activeService = activeResult.ok ? activeResult.service : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Ministério Infantil</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Horários dos cultos usados na identificação automática do check-in.
        </div>
      </div>

      <KidsSubNav />

      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          activeService
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            : "border-border bg-muted/20 text-muted-foreground"
        }`}
      >
        {activeService
          ? `Culto ativo agora: ${activeService.name} (${activeService.startTime} → ${activeService.endTime})`
          : NO_ACTIVE_SERVICE_MESSAGE}
      </div>

      <KidsServiceManager
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          toleranceMinutes: s.toleranceMinutes,
          isActive: s.isActive,
        }))}
        activeServiceId={activeService?.id ?? null}
        canWrite={canWrite}
      />
    </div>
  );
}
