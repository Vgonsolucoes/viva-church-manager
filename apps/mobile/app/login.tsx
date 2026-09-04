import React, { useEffect } from "react";
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { LoginInputSchema, type LoginInput } from "@/types";

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, login, loading, error, clearError } = useAuth();

  const {
    control,
    handleSubmit,
    setError: setFormError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    if (isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (error && error.includes("UNAUTHENTICATED")) {
      setFormError("password", {
        type: "manual",
        message: "E-mail ou senha incorretos.",
      });
    } else if (error && error.includes("Muitas tentativas")) {
      setFormError("email", { type: "manual", message: error });
    }
    if (error) {
      const t = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(t);
    }
  }, [error, setFormError, clearError]);

  async function onSubmit(data: LoginInput) {
    try {
      await login(data);
    } catch (e) {
      // Errors surfaced via effect
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBarTheme />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoCircle}>
              <Ionicons name="heart" size={44} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Viva Church</Text>
            <Text style={styles.subtitle}>Amor, comunidade e discipulado.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entrar</Text>
            <Text style={styles.cardSub}>
              Use a mesma conta do sistema web para acessar o app.
            </Text>

            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  wrapperStyle={{ marginBottom: 14 }}
                  label="E-mail"
                  placeholder="voce@vivasede.com.br"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  value={field.value}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input
                  wrapperStyle={{ marginBottom: 10 }}
                  label="Senha"
                  placeholder="Sua senha"
                  secureTextEntry
                  autoComplete="password"
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  value={field.value}
                  error={errors.password?.message}
                />
              )}
            />

            <View style={styles.forgotWrap}>
              <Text style={styles.forgotText}>
                Esqueci minha senha (em breve).
              </Text>
            </View>

            <Button
              style={{ marginTop: 14 }}
              size="lg"
              fullWidth
              loading={loading}
              onPress={handleSubmit(onSubmit)}
              leftIcon={<Ionicons name="log-in-outline" size={18} color="#FFFFFF" />}
            >
              Entrar no App
            </Button>

            {error && !errors.password ? (
              <Text style={styles.globalError}>
                Acesso negado. Verifique seus dados e tente novamente.
              </Text>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Você com Cristo, nós com você.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusBarTheme() {
  return (
    <View style={{ height: 0 }} pointerEvents="none">
      {null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    justifyContent: "space-between",
  },
  hero: {
    marginTop: 20,
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: theme.colors.primary,
    fontSize: theme.font.md,
    fontWeight: "500",
    opacity: 0.95,
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.xl,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardTitle: {
    color: theme.colors.foregroundDark,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardSub: {
    color: theme.colors.muted,
    fontSize: theme.font.sm,
    marginBottom: 22,
  },
  forgotWrap: { marginTop: 4, alignSelf: "flex-end" },
  forgotText: {
    color: theme.colors.primary,
    fontSize: theme.font.sm,
    fontWeight: "600",
  },
  globalError: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.destructiveSoft,
    color: theme.colors.destructive,
    fontWeight: "600",
    fontSize: theme.font.sm,
  },
  footer: {
    marginTop: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
  footerText: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: theme.font.sm,
    fontWeight: "500",
  },
});
