import { useEffect } from "react";
import { AppState } from "react-native";
import { useSessionStore } from "@/stores/session";
import {
  syncArrivalMonitoring,
  stopArrivalMonitoring,
} from "@/services/arrival";

export function ArrivalIntegration() {
  const token = useSessionStore((state) => state.accessToken);
  const memberId = useSessionStore((state) => state.me?.member?.id);
  const initialized = useSessionStore((state) => state.initialized);
  useEffect(() => {
    if (!initialized) return;
    if (!token) {
      void stopArrivalMonitoring(true).catch(() => {});
      return;
    }
    if (!memberId) return;
    const sync = () => {
      void syncArrivalMonitoring().catch(() => {});
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, [token, memberId, initialized]);
  return null;
}
