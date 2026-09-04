import { useEffect, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useUiStore } from "@/stores/uiStore";

export function useNetwork() {
  const { isOffline, setOffline } = useUiStore();

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    const offline =
      state.isConnected === false || state.isInternetReachable === false;
    setOffline(offline);
  }, [setOffline]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline =
        state.isConnected === false || state.isInternetReachable === false;
      setOffline(offline);
    });

    return () => unsubscribe();
  }, [setOffline]);

  return { isOffline, refresh };
}
