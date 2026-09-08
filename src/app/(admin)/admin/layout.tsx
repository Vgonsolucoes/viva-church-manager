import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { safeImageSrcOrUndefined } from "@/lib/safe-image-src";

export const dynamic = "force-dynamic";

export default async function AdminLayout(props: { children: React.ReactNode }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const roles = session.roles ?? [];
    if (!hasPermission(roles, "admin:access")) redirect("/app");

    const unreadNotifications = session.uid
      ? await prisma.notificationDelivery.count({
          where: { userId: session.uid, readAt: null },
        })
      : 0;

    let resolvedAvatar: string | undefined = safeImageSrcOrUndefined(
      session.user?.image ?? null,
    );
    if (session.uid && !resolvedAvatar) {
      const linked = await prisma.user.findUnique({
        where: { id: session.uid },
        select: {
          imageUrl: true,
          member: { select: { photoUrl: true } },
        },
      });
      resolvedAvatar =
        safeImageSrcOrUndefined(linked?.imageUrl ?? null) ??
        safeImageSrcOrUndefined(linked?.member?.photoUrl ?? null);
    }

    return (
      <AdminShell
        user={{
          name: session.user?.name,
          email: session.user?.email,
          image: resolvedAvatar ?? undefined,
          roles,
          unreadNotifications,
        }}
      >
        {props.children}
      </AdminShell>
    );
  } catch (err) {
    console.error("[admin] AdminLayout SSR render falhou:", err);
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="rounded-xl border border-border bg-card p-6 text-sm">
            <div className="font-semibold">Sessão inválida ou indisponível</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Por favor, faça login novamente.
            </div>
            <a
              href="/login"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Ir para login
            </a>
          </div>
          {props.children}
        </div>
      </div>
    );
  }
}
