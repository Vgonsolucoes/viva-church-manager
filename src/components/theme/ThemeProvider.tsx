"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

type ThemeMode = "light" | "dark";
const STORAGE_KEY = "viva-church-theme";
const listeners = new Set<() => void>();
let selected: ThemeMode | null = null;
function getSnapshot(): ThemeMode {
  if (selected) return selected;
  try { return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
const getServerSnapshot = (): ThemeMode => "light";
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) { selected = null; listener(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
function setTheme(theme: ThemeMode) {
  selected = theme;
  try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* Keep the toggle usable without browser storage. */ }
  listeners.forEach(listener => listener());
}
const ThemeContext = createContext<{ resolvedTheme: ThemeMode; setTheme: typeof setTheme } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }, [theme]);
  const value = useMemo(() => ({ resolvedTheme: theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
