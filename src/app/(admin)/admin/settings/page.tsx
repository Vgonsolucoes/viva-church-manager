import { Card } from "@/components/ui/Card";

export default async function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Configurações</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Parâmetros gerais do sistema, perfis, permissões e integrações.
        </div>
      </div>

      <Card className="p-5">
        <div className="text-sm text-muted-foreground">
          Em construção. Centralizará configurações de perfis, notificações e integrações.
        </div>
      </Card>
    </div>
  );
}

