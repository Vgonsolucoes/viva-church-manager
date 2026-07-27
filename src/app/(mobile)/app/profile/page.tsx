import { getServerSession } from "next-auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { authOptions } from "@/server/auth";
import { SignOutButton } from "@/app/(mobile)/app/profile/SignOutButton";

export default async function MobileProfilePage() {
  const session = await getServerSession(authOptions);
  const roles = session?.roles ?? [];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">Meu perfil</div>
        <div className="text-sm text-muted-foreground">
          Dados e permissões da sua conta.
        </div>
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium">{session?.user?.name ?? "Usuário"}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {session?.user?.email ?? ""}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.length ? roles.map((r) => <Badge key={r}>{r}</Badge>) : <Badge>MEMBER</Badge>}
        </div>
      </Card>

      <SignOutButton />
    </div>
  );
}
