import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { Card } from "@/components/ui/Card";
import {
  getConfiguredAppUrl,
  getPublicMemberRegistrationPath,
  isPublicMemberRegistrationEnabled,
} from "@/server/settings";
import { CadastroPublicoClient } from "./CadastroPublicoClient";

export const dynamic = "force-dynamic";

export default async function CadastroPublicoSettingsPage() {
  const session = await getServerSession(authOptions);
  const canManage = hasPermission((session?.roles ?? []) as RoleKey[], "settings:manage");
  const enabled = await isPublicMemberRegistrationEnabled();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Cadastro Público de Membros</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Permita que pessoas façam seu próprio cadastro na Viva Church. Quando habilitado, qualquer
          pessoa com o link público poderá preencher o formulário — isso não concede acesso ao
          painel administrativo.
        </div>
      </div>

      <Card className="p-5">
        <CadastroPublicoClient
          enabled={enabled}
          publicPath={getPublicMemberRegistrationPath()}
          configuredBaseUrl={getConfiguredAppUrl()}
          canManage={canManage}
        />
      </Card>
    </div>
  );
}
