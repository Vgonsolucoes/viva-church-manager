import Link from "next/link";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/settings/whatsapp" className="group">
          <Card className="h-full p-5 transition-colors group-hover:border-ring/50">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-lg">
                💬
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">WhatsApp</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Conexão Evolution API — instância automática via QR Code.
                </div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/admin/settings/cadastro-publico" className="group">
          <Card className="h-full p-5 transition-colors group-hover:border-ring/50">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/10 text-lg">
                📝
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">
                  Cadastro Público de Membros
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Ativar/desativar o formulário público, copiar link e QR Code.
                </div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <Card className="p-5">
        <div className="text-sm text-muted-foreground">
          Em construção. Centralizará configurações de perfis, notificações e demais integrações.
        </div>
      </Card>
    </div>
  );
}
