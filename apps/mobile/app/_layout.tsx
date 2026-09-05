import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Text, Animated } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { LinearGradient } from "expo-linear-gradient";
import { useSessionStore } from "@/stores/session";
import { theme } from "@/theme";
import { useNetwork } from "@/hooks/useNetwork";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, gcTime: 60_000 },
    mutations: { retry: 0 },
  },
});

SplashScreen.preventAutoHideAsync().catch(() => {});

function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => onFinish(), 200);
    });
  }, [fadeAnim, scaleAnim, onFinish]);

  return (
    <View style={styles.splash}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          alignItems: "center",
        }}
      >
        <LinearGradient
          colors={[theme.colors.gradientFrom, theme.colors.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoGradient}
        >
          <Text style={styles.logoLetter}>V</Text>
        </LinearGradient>
        <Text style={styles.brandName}>VIVA CHURCH</Text>
        <Text style={styles.sloganLine1}>Conectando pessoas.</Text>
        <Text style={styles.sloganLine2}>Vivendo propósito.</Text>
      </Animated.View>
    </View>
  );
}

function AuthGuard({
  children,
  fontsReady,
}: {
  children: React.ReactNode;
  fontsReady: boolean;
}) {
  const segments = useSegments();
  const router = useRouter();
  const { accessToken, initialized } = useSessionStore();
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

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

  const allReady = ready && initialized && fontsReady && splashDone;

  useEffect(() => {
    if (allReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [allReady]);

  if (!splashDone) {
    return <AnimatedSplash onFinish={() => setSplashDone(true)} />;
  }
  if (!allReady) {
    return (
      <View style={styles.splash}>
        <Text style={styles.brandName}>VIVA CHURCH</Text>
      </View>
    );
  }
  return <>{children}</>;
}

function NetworkInit() {
  const { refresh } = useNetwork();
  useEffect(() => {
    refresh();
  }, [refresh]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <NetworkInit />
          <AuthGuard fontsReady={fontsLoaded}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.foreground,
                headerTitleStyle: {
                  color: theme.colors.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 18,
                },
                headerBackTitleStyle: {
                  fontFamily: "Inter_500Medium",
                },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="igreja" options={{ headerShown: false }} />
              <Stack.Screen
                name="perfil/editar"
                options={{
                  title: "Editar perfil",
                  headerBackTitle: "Voltar",
                }}
              />
              <Stack.Screen
                name="qr/scan"
                options={{
                  title: "Escanear QR",
                  headerBackTitle: "Voltar",
                }}
              />
              <Stack.Screen
                name="carteirinha"
                options={{
                  title: "Carteirinha",
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
    padding: theme.spacing.xl,
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.gradientFrom,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logoLetter: {
    color: theme.colors.foreground,
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    lineHeight: 56,
  },
  brandName: {
    color: theme.colors.foreground,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
    marginBottom: theme.spacing.lg,
  },
  sloganLine1: {
    color: theme.colors.foregroundMuted,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 6,
  },
  sloganLine2: {
    color: theme.colors.foregroundMuted,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
