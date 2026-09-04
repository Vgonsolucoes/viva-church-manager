import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSessionStore } from "@/stores/session";
import { theme } from "@/constants/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, gcTime: 60_000 },
    mutations: { retry: 0 },
  },
});

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const { accessToken, initialized } = useSessionStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void useSessionStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const inAuth =
      typeof segments[0] === "string" && segments[0].startsWith("login");
    if (!accessToken && !inAuth) {
      router.replace("/login");
      setReady(true);
      return;
    }
    if (accessToken && inAuth) {
      router.replace("/");
      setReady(true);
      return;
    }
    setReady(true);
  }, [initialized, accessToken, segments, router]);

  useEffect(() => {
    if (ready && initialized) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, initialized]);

  if (!initialized || !ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashText}>VIVA CHURCH</Text>
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: "#FFFFFF",
                headerTitleStyle: { color: "#FFFFFF", fontWeight: "700" },
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="perfil/biometria"
                options={{
                  title: "Biometria",
                  headerBackTitle: "Voltar",
                }}
              />
            </Stack>
          </AuthGuard>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  splashText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
