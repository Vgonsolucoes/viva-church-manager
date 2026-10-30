"use client";
import { useActionState } from "react";
import { sendParkingNotice } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ParkingNoticeForm() {
  const [state, action, pending] = useActionState(sendParkingNotice, { ok: false, message: "" });
  return <form action={action} className="space-y-4 rounded-3xl border border-border bg-card p-5">
    <h2 className="text-lg font-semibold">Chamar proprietário</h2>
    <div className="grid gap-4 md:grid-cols-3">
      <label className="space-y-2 text-sm">Placa<Input name="plate" placeholder="ABC1D23" required maxLength={9} autoComplete="off" className="uppercase" /></label>
      <label className="space-y-2 text-sm">Modelo do veículo<Input name="vehicle" placeholder="Ex.: Onix" maxLength={80} /></label>
      <label className="space-y-2 text-sm">Cor<Input name="color" placeholder="Ex.: Prata" maxLength={30} /></label>
    </div>
    <label className="block space-y-2 text-sm">Local para comparecer<Input name="location" defaultValue="Estacionamento da igreja" required minLength={3} maxLength={80} /></label>
    <label className="block space-y-2 text-sm">Mensagem<textarea name="message" defaultValue="Solicitamos que o proprietário compareça ao estacionamento." required minLength={3} maxLength={240} rows={3} className="w-full rounded-2xl border border-border bg-background p-3" /></label>
    <p className="text-xs text-muted-foreground">O aviso será recebido pela equipe de projeção, com placa, veículo e local.</p>
    {state.message ? <p role="status" className={state.ok ? "text-emerald-400" : "text-red-400"}>{state.message}</p> : null}
    <Button disabled={pending}>{pending ? "Enviando…" : "Enviar para projeção"}</Button>
  </form>;
}
