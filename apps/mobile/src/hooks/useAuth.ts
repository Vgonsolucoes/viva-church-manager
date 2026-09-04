import { useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { useSessionStore } from "@/stores/session";
import type { LoginInput } from "@/types";

export function useAuth() {
  const {
    accessToken,
    accessTokenExpiresAt,
    me,
    loading,
    error,
    initialized,
    hydrate,
    login,
    logout,
    refreshMe,
    clearError,
  } = useSessionStore();

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void hydrate();
  }, [hydrate]);

  useFocusEffect(() => {
    if (initialized && accessToken) void refreshMe(false);
  });

  const isAuthenticated = !!accessToken && !!me;

  return {
    isAuthenticated,
    initialized,
    accessToken,
    accessTokenExpiresAt,
    me,
    loading,
    error,
    login: (input: LoginInput) => login(input),
    logout: () => logout(),
    refreshMe: (force?: boolean) => refreshMe(force),
    clearError,
  };
}
