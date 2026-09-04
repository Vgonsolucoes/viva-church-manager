import { API_BASE_URL, API_TIMEOUT_MS, API_RETRY_429_MAX } from "@/constants/api";
import {
  getSessionToken,
  clearSessionPersistence,
} from "@/stores/session";
import type { ApiErrorShape } from "@/types";

export class ApiError extends Error {
  status: number;
  data: ApiErrorShape | null;
  constructor(status: number, data: ApiErrorShape | null, message?: string) {
    super(message ?? `Erro ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  skipAuth?: boolean;
  signal?: AbortSignal;
};

type PromiseResolve<T> = (value: T) => void;
type PromiseReject = (err: unknown) => void;

const pendingLogoutSentinel: { promise: Promise<void> | null } = { promise: null };

function abortAfter(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

async function requestInternal<T = unknown>(
  path: string,
  options: RequestOptions & { _attempt?: number },
): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    timeoutMs = API_TIMEOUT_MS,
    skipAuth = false,
    signal,
    _attempt = 0,
  } = options;

  const url = buildUrl(path);
  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers ?? {}),
  };
  const isJson =
    typeof body === "object" &&
    body !== null &&
    !(body instanceof FormData);
  if (isJson) {
    reqHeaders["Content-Type"] = "application/json";
  }
  if (!skipAuth) {
    const token = await getSessionToken();
    if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  const { signal: timeoutSignal, clear } = abortAfter(timeoutMs);
  const combinedSignal = signal ?? timeoutSignal;
  let cleanup = clear;
  if (signal && signal !== timeoutSignal) {
    const outer = signal;
    const oldClear = clear;
    cleanup = () => {
      oldClear();
      // AbortController external signal doesn't need cleanup here
      void outer;
    };
  }

  try {
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: isJson ? JSON.stringify(body) : (body as BodyInit | undefined),
      signal: combinedSignal,
    });

    let parsed: unknown = null;
    const text = await res.text();
    if (text && text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (res.status === 401 && !skipAuth) {
      await triggerGlobalLogout();
      const errorData = (parsed ?? { error: "UNAUTHENTICATED" }) as ApiErrorShape;
      throw new ApiError(401, errorData, "Sessão expirada");
    }

    if (res.status === 429 && _attempt < API_RETRY_429_MAX) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter && /^\d+$/.test(retryAfter)
        ? Math.max(1_000, Number(retryAfter) * 1_000)
        : 1_500;
      await new Promise<void>((r) => setTimeout(r, waitMs));
      return requestInternal<T>(path, { ...options, _attempt: _attempt + 1 });
    }

    if (!res.ok) {
      const errorData = (parsed ?? null) as ApiErrorShape | null;
      throw new ApiError(
        res.status,
        errorData,
        errorData?.message ?? errorData?.error ?? `Erro ${res.status}`,
      );
    }

    return parsed as T;
  } finally {
    cleanup();
  }
}

async function triggerGlobalLogout(): Promise<void> {
  if (pendingLogoutSentinel.promise) return pendingLogoutSentinel.promise;
  const p = (async () => {
    try {
      await clearSessionPersistence();
    } finally {
      pendingLogoutSentinel.promise = null;
    }
  })();
  pendingLogoutSentinel.promise = p;
  return p;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function buildHeaders(
  extraHeaders?: Record<string, string>,
  skipAuth = false,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(extraHeaders ?? {}),
  };
  if (!skipAuth) {
    const token = await getSessionToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  get<T = unknown>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return requestInternal<T>(path, { ...options, method: "GET" });
  },
  post<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return requestInternal<T>(path, { ...options, method: "POST", body });
  },
  patch<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return requestInternal<T>(path, { ...options, method: "PATCH", body });
  },
  put<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return requestInternal<T>(path, { ...options, method: "PUT", body });
  },
  delete<T = unknown>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return requestInternal<T>(path, { ...options, method: "DELETE" });
  },
};

// Ensure helpers referenced from session.ts have a chance to resolve
export type _ApiClient = typeof api;

// Satisfy unused checks
export type _RequestOpts = RequestOptions;
type _P = PromiseResolve<unknown>;
type _Q = PromiseReject;
void (null as unknown as _P | _Q | _ApiClient | _RequestOpts);
