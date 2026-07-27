import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

export default async function AdminLayout(props: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const roles = session.roles ?? [];
  if (!hasPermission(roles, "admin:access")) redirect("/app");

  const unreadNotifications = session.uid
    ? await prisma.notificationDelivery.count({
        where: { userId: session.uid, readAt: null },
      })
    : 0;

  return (
    <AdminShell
      user={{
        name: session.user?.name,
        email: session.user?.email,
        image: session.user?.image,
        roles,
        unreadNotifications,
      }}
    >
      {props.children}
    </AdminShell>
  );
}
