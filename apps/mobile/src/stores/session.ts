import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { isJwtExpired } from "@/utils/jwt";
import { postLogin } from "@/services/api/auth";
import { getMe } from "@/services/api/me";
import { unregisterPushDevice } from "@/services/api/pushDevices";
import type { LoginInput, Me, LoginResponse } from "@/types";

const SECURE_TOKEN_KEY = "vc:access_token";
const ASYNC_ME_KEY = "vc:me_cache";

type SessionState = {
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  me: Me | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  expoPushToken: string | null;
  hydrate: () => Promise<void>;
  login: (input: LoginInput) => Promise<Me>;
  refreshMe: (force?: boolean) => Promise<Me | null>;
  logout: () => Promise<void>;
  setExpoPushToken: (token: string | null) => void;
  clearError: () => void;
};

let getTokenSnapshot: () => string | null = () => null;

export async function getSessionToken(): Promise<string | null> {
  const local = getTokenSnapshot();
  if (local && !isJwtExpired(local, 120)) return local;
  const stored = await readSecureToken();
  if (stored && !isJwtExpired(stored, 120)) {
    getTokenSnapshot = () => stored;
    return stored;
  }
  return null;
}

export async function clearSessionPersistence(): Promise<void> {
  try {
    if (Platform.OS !== "web") {
      try {
        await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
      } catch {
        // web fallback
      }
    }
    await AsyncStorage.removeItem(ASYNC_ME_KEY);
    if (Platform.OS === "web") {
      try {
        const storage =
          (globalThis as unknown as { localStorage?: Storage }).localStorage;
        if (storage) storage.removeItem(SECURE_TOKEN_KEY);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  } finally {
    getTokenSnapshot = () => null;
  }
}

async function readSecureToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      const storage =
        (globalThis as unknown as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      return storage.getItem(SECURE_TOKEN_KEY) ?? null;
    }
    const value = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    return value ?? null;
  } catch {
    return null;
  }
}

async function writeSecureToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    const storage =
      (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (storage) storage.setItem(SECURE_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
}

async function readMeCache(): Promise<Me | null> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_ME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "id" in parsed) {
      return parsed as Me;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeMeCache(me: Me | null): Promise<void> {
  try {
    if (me) {
      await AsyncStorage.setItem(ASYNC_ME_KEY, JSON.stringify(me));
    } else {
      await AsyncStorage.removeItem(ASYNC_ME_KEY);
    }
  } catch {
    // ignore
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  accessTokenExpiresAt: null,
  me: null,
  loading: false,
  error: null,
  initialized: false,
  expoPushToken: null,

  async hydrate() {
    if (get().initialized) return;
    try {
      const token = await readSecureToken();
      const cachedMe = await readMeCache();
      if (token) {
        getTokenSnapshot = () => token;
      }
      set({
        accessToken: token,
        me: cachedMe,
        initialized: true,
      });
    } catch (e) {
      set({ initialized: true, error: e instanceof Error ? e.message : "hydrate_failed" });
    }
  },

  async login(input: LoginInput) {
    set({ loading: true, error: null });
    try {
      const loginRes: LoginResponse = await postLogin(input);
      await writeSecureToken(loginRes.accessToken);
      getTokenSnapshot = () => loginRes.accessToken;
      set({
        accessToken: loginRes.accessToken,
        accessTokenExpiresAt: loginRes.expiresAt,
      });
      const me = await getMe();
      await writeMeCache(me);
      set({ me, loading: false });
      return me;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "login_failed";
      set({ loading: false, error: message });
      throw e;
    }
  },

  async refreshMe(force = false) {
    const { accessToken, me } = get();
    if (!accessToken) {
      set({ me: null });
      return null;
    }
    if (!force && me) return me;
    set({ loading: true });
    try {
      const fresh = await getMe();
      await writeMeCache(fresh);
      set({ me: fresh, loading: false, error: null });
      return fresh;
    } catch (e) {
      const message = e instanceof Error ? e.message : "me_refresh_failed";
      set({ loading: false, error: message });
      return me;
    }
  },

  async logout() {
    set({ loading: true });
    try {
      const currentToken = get().expoPushToken;
      if (currentToken) {
        try {
          await unregisterPushDevice(currentToken);
        } catch {
          // ignore network errors during logout
        }
      }
      await clearSessionPersistence();
      set({
        accessToken: null,
        accessTokenExpiresAt: null,
        me: null,
        expoPushToken: null,
        loading: false,
        error: null,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "logout_failed" });
    }
  },

  setExpoPushToken(token: string | null) {
    set({ expoPushToken: token });
  },

  clearError() {
    set({ error: null });
  },
}));
