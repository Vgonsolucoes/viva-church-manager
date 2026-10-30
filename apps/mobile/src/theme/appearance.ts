import { useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
export type AppearanceMode = "light" | "dark";
const KEY = "viva-church-appearance";
let hydration: Promise<void> | undefined;
let changed = false;
let persistence = Promise.resolve();
export const useAppearance = create<{
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  hydrate: () => Promise<void>;
}>((set) => ({
  mode: "light",
  setMode: (mode) => {
    changed = true;
    set({ mode });
    persistence = persistence.then(() => AsyncStorage.setItem(KEY, mode)).catch(() => {});
  },
  hydrate: () => hydration ??= AsyncStorage.getItem(KEY).then((mode) => {
    if (!changed && (mode === "light" || mode === "dark")) set({ mode });
  }).catch(() => {}),
}));
/** Cache immutable StyleSheets by palette. */
export function useThemedStyles<T, S>(factory: (theme: T) => S, theme: T): S {
  return useMemo(() => factory(theme), [factory, theme]);
}
export function useHydrateAppearance() {
  useEffect(() => { void useAppearance.getState().hydrate(); }, []);
}
