const INSTANCE_NAME = "viva-church";

export function evolutionConfig() {
  const baseUrl = String(process.env.EVOLUTION_API_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = String(process.env.EVOLUTION_API_KEY ?? "").trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, instanceName: INSTANCE_NAME };
}

async function evolutionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = evolutionConfig();
  if (!cfg) throw new Error("Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY).");
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.apiKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message?: unknown }).message)
        : `HTTP ${res.status}`;
    throw new Error(`Evolution API: ${msg}`);
  }
  return data as T;
}

export type EvolutionConnectionState = "open" | "close" | "connecting" | "unknown";

export async function evolutionInstanceState(): Promise<{
  exists: boolean;
  state: EvolutionConnectionState;
}> {
  const cfg = evolutionConfig();
  if (!cfg) return { exists: false, state: "unknown" };
  try {
    const data = await evolutionFetch<{ instance?: { state?: string } }>(
      `/instance/connectionState/${encodeURIComponent(cfg.instanceName)}`,
    );
    const raw = String(data?.instance?.state ?? "").toLowerCase();
    const state: EvolutionConnectionState =
      raw === "open" ? "open" : raw === "close" ? "close" : raw === "connecting" ? "connecting" : "unknown";
    return { exists: true, state };
  } catch {
    return { exists: false, state: "unknown" };
  }
}

export async function evolutionCreateInstance(): Promise<{ qrcodeBase64: string | null }> {
  const cfg = evolutionConfig();
  if (!cfg) throw new Error("Evolution API não configurada.");
  const data = await evolutionFetch<{ qrcode?: { base64?: string }; hash?: string }>(
    `/instance/create`,
    {
      method: "POST",
      body: JSON.stringify({
        instanceName: cfg.instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        rejectCall: true,
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      }),
    },
  );
  return { qrcodeBase64: data?.qrcode?.base64 ?? null };
}

export async function evolutionGetQrCode(): Promise<{ qrcodeBase64: string | null }> {
  const cfg = evolutionConfig();
  if (!cfg) throw new Error("Evolution API não configurada.");
  const data = await evolutionFetch<{ base64?: string; code?: string }>(
    `/instance/connect/${encodeURIComponent(cfg.instanceName)}`,
  );
  return { qrcodeBase64: data?.base64 ?? null };
}

export async function evolutionLogoutInstance(): Promise<void> {
  const cfg = evolutionConfig();
  if (!cfg) return;
  await evolutionFetch(`/instance/logout/${encodeURIComponent(cfg.instanceName)}`, {
    method: "DELETE",
  });
}

export async function evolutionDeleteInstance(): Promise<void> {
  const cfg = evolutionConfig();
  if (!cfg) return;
  await evolutionFetch(`/instance/delete/${encodeURIComponent(cfg.instanceName)}`, {
    method: "DELETE",
  });
}
