import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/server/auth";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { KidsProjectionScreen } from "./KidsProjectionScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comunicação Kids — Projeção",
};

// Tela exclusiva da projeção (seções 17 e 22 da spec): fora do painel admin,
// com acesso controlado por sessão + permissão kids:projection:view.
// Defesa em profundidade: o middleware também protege /kids/*.
export default async function KidsProjecaoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.uid) {
    redirect("/login?callbackUrl=/kids/projecao");
  }

  const roles = (session.roles ?? []) as RoleKey[];
  if (!hasPermission(roles, "kids:projection:view")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <div className="text-lg font-semibold">Acesso restrito</div>
          <p className="mt-2 text-sm text-white/70">
            Esta tela é exclusiva da equipe de projeção. Solicite a um
            administrador um usuário com o perfil de Projeção.
          </p>
        </div>
      </main>
    );
  }

  return <KidsProjectionScreen operatorName={session.user?.name ?? null} />;
}
