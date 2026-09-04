const fallback = "https://viva-church-manager-app.54myeq.easypanel.host";
declare const globalThis: {
  process?: { env?: Record<string, string | undefined> };
};
const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
const fromEnv = g.process?.env?.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = (fromEnv ?? fallback).replace(/\/+$/, "");
export const API_TIMEOUT_MS = 20_000;
export const API_RETRY_429_MAX = 1;
