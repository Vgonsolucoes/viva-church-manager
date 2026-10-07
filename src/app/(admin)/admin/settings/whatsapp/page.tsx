import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { evolutionConfig, evolutionInstanceState } from "@/server/evolution";
import { WhatsAppClient } from "./WhatsAppClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WhatsAppSettingsPage() {
  const configured = Boolean(evolutionConfig());
  let exists = false;
  let state: "open" | "close" | "connecting" | "unknown" = "unknown";
  let initialError: string | null = null;

  if (configured) {
    try {
      const status = await evolutionInstanceState();
      exists = status.exists;
      state = status.state;
    } catch {
      initialError = "Não foi possível consultar a Evolution API no momento.";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        description="Conexão com a Evolution API — crie a instância e conecte via QR Code."
      />
      <Card className="p-5">
        <WhatsAppClient
          initialConfigured={configured}
          initialExists={exists}
          initialState={state}
          initialError={initialError}
        />
      </Card>
    </div>
  );
}
