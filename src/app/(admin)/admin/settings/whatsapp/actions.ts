"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import {
  evolutionConfig,
  evolutionCreateInstance,
  evolutionDeleteInstance,
  evolutionGetQrCode,
  evolutionInstanceState,
  evolutionLogoutInstance,
  type EvolutionConnectionState,
} from "@/server/evolution";

export type WhatsAppActionResult = {
  ok: boolean;
  configured: boolean;
  exists: boolean;
  state: EvolutionConnectionState;
  qrcodeBase64: string | null;
  error?: string;
};

async function requireSession(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.id);
}

function mapError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw || "Erro desconhecido ao comunicar com a Evolution API.";
}

export async function whatsappGetStatus(): Promise<WhatsAppActionResult> {
  if (!(await requireSession())) {
    return { ok: false, configured: false, exists: false, state: "unknown", qrcodeBase64: null, error: "Sessão expirada. Faça login novamente." };
  }
  const configured = Boolean(evolutionConfig());
  if (!configured) {
    return {
      ok: false,
      configured: false,
      exists: false,
      state: "unknown",
      qrcodeBase64: null,
      error: "Variáveis EVOLUTION_API_URL e EVOLUTION_API_KEY não configuradas no servidor.",
    };
  }
  try {
    const status = await evolutionInstanceState();
    return { ok: true, configured: true, exists: status.exists, state: status.state, qrcodeBase64: null };
  } catch (error) {
    return { ok: false, configured: true, exists: false, state: "unknown", qrcodeBase64: null, error: mapError(error) };
  }
}

export async function whatsappCreateAndGetQr(): Promise<WhatsAppActionResult> {
  if (!(await requireSession())) {
    return { ok: false, configured: false, exists: false, state: "unknown", qrcodeBase64: null, error: "Sessão expirada. Faça login novamente." };
  }
  if (!evolutionConfig()) {
    return {
      ok: false,
      configured: false,
      exists: false,
      state: "unknown",
      qrcodeBase64: null,
      error: "Variáveis EVOLUTION_API_URL e EVOLUTION_API_KEY não configuradas no servidor.",
    };
  }
  try {
    const status = await evolutionInstanceState();
    if (!status.exists) {
      const created = await evolutionCreateInstance();
      const after = await evolutionInstanceState();
      return {
        ok: true,
        configured: true,
        exists: after.exists,
        state: after.state,
        qrcodeBase64: created.qrcodeBase64,
      };
    }
    const qr = await evolutionGetQrCode();
    return {
      ok: true,
      configured: true,
      exists: true,
      state: status.state,
      qrcodeBase64: qr.qrcodeBase64,
    };
  } catch (error) {
    return { ok: false, configured: true, exists: false, state: "unknown", qrcodeBase64: null, error: mapError(error) };
  }
}

export async function whatsappRefreshQr(): Promise<WhatsAppActionResult> {
  if (!(await requireSession())) {
    return { ok: false, configured: false, exists: false, state: "unknown", qrcodeBase64: null, error: "Sessão expirada. Faça login novamente." };
  }
  try {
    const qr = await evolutionGetQrCode();
    const status = await evolutionInstanceState();
    return {
      ok: true,
      configured: true,
      exists: status.exists,
      state: status.state,
      qrcodeBase64: qr.qrcodeBase64,
    };
  } catch (error) {
    return { ok: false, configured: true, exists: false, state: "unknown", qrcodeBase64: null, error: mapError(error) };
  }
}

export async function whatsappDisconnect(): Promise<WhatsAppActionResult> {
  if (!(await requireSession())) {
    return { ok: false, configured: false, exists: false, state: "unknown", qrcodeBase64: null, error: "Sessão expirada. Faça login novamente." };
  }
  try {
    await evolutionLogoutInstance();
    return { ok: true, configured: true, exists: true, state: "close", qrcodeBase64: null };
  } catch (error) {
    return { ok: false, configured: true, exists: false, state: "unknown", qrcodeBase64: null, error: mapError(error) };
  }
}

export async function whatsappDeleteInstance(): Promise<WhatsAppActionResult> {
  if (!(await requireSession())) {
    return { ok: false, configured: false, exists: false, state: "unknown", qrcodeBase64: null, error: "Sessão expirada. Faça login novamente." };
  }
  try {
    await evolutionDeleteInstance();
    return { ok: true, configured: true, exists: false, state: "unknown", qrcodeBase64: null };
  } catch (error) {
    return { ok: false, configured: true, exists: false, state: "unknown", qrcodeBase64: null, error: mapError(error) };
  }
}
