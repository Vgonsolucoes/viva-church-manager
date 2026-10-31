import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { WeeklyServices } from "@/components/events/WeeklyServices";
import { authOptions } from "@/server/auth";
import { hasPermission } from "@/server/rbac";
import { ensureWeeklyServices } from "@/server/weekly-services";

export const dynamic = "force-dynamic";

export default async function FixedServicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.uid) redirect("/login");
  if (!hasPermission(session.permissions ?? [], "events:read") && !hasPermission(session.permissions ?? [], "events:write")) redirect("/admin");
  await ensureWeeklyServices();
  return <WeeklyServices />;
}
