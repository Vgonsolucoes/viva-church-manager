"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";

export function KidsCheckinQrPoster(props: { token: string }) {
  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #kids-checkin-poster, #kids-checkin-poster * { visibility: visible; }
          #kids-checkin-poster {
            position: fixed;
            inset: 0;
            margin: 0;
            border: none !important;
            border-radius: 0 !important;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>

      <div
        id="kids-checkin-poster"
        className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-border bg-white p-10 text-center"
      >
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight text-neutral-900">
            VIVA CHURCH KIDS
          </div>
          <div className="text-lg font-semibold tracking-[0.3em] text-neutral-500">CHECK-IN</div>
        </div>

        <div className="rounded-2xl border-4 border-neutral-900 p-4">
          <QRCodeSVG value={props.token} size={240} level="M" includeMargin={false} />
        </div>

        <div className="space-y-1 text-sm leading-relaxed text-neutral-600">
          <div>Abra o Viva Church App</div>
          <div>→ Kids</div>
          <div>→ Fazer Check-in</div>
          <div>→ Escaneie este QR Code</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
          🖨️ Imprimir cartaz
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Este QR Code é fixo e representa o ponto de check-in do Ministério Infantil — ele não
        contém dados de nenhuma criança e não expira. O culto ativo é identificado
        automaticamente pelo sistema no momento da leitura, conforme os horários cadastrados.
      </div>
    </div>
  );
}
