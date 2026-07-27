import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function MobileHomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">
          Olá, {session?.user?.name ?? "bem-vindo"}.
        </div>
        <div className="text-sm text-muted-foreground">
          Acompanhe agenda, eventos e suas escalas.
        </div>
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium">Próximos passos</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>Agenda</Badge>
          <Badge>Eventos</Badge>
          <Badge>Notificações</Badge>
          <Badge>Escalas</Badge>
        </div>
      </Card>
    </div>
  );
}
