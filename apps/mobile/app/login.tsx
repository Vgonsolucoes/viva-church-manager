import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, Lock, Apple } from "lucide-react-native";
import { theme } from "@/theme";
import { Input } from "@/components/Input";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { LoginInputSchema, type LoginInput } from "@/types";

const { height } = Dimensions.get("window");

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, login, loading, error, clearError } = useAuth();
  const [remember, setRemember] = useState(true);

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
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <LinearGradient
              colors={[theme.colors.gradientFrom, theme.colors.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoLetter}>V</Text>
            </LinearGradient>
            <Text style={styles.brandName}>VIVA CHURCH</Text>
            <Text style={styles.slogan1}>Conectando pessoas.</Text>
            <Text style={styles.slogan2}>Vivendo propósito.</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.welcomeTitle}>Seja bem-vindo</Text>
            <Text style={styles.welcomeSubtitle}>
              Entre com sua conta para continuar
            </Text>

            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  wrapperStyle={styles.inputWrap}
                  label="E-mail"
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  value={field.value}
                  error={errors.email?.message}
                  leftIcon={<Mail size={18} color={theme.colors.foregroundMuted} />}
                />
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input
                  wrapperStyle={styles.inputWrap}
                  label="Senha"
                  placeholder="Sua senha"
                  secureTextEntry
                  autoComplete="password"
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  value={field.value}
                  error={errors.password?.message}
                  leftIcon={<Lock size={18} color={theme.colors.foregroundMuted} />}
                />
              )}
            />

            <View style={styles.optionsRow}>
              <Pressable
                style={styles.checkboxRow}
                onPress={() => setRemember((r) => !r)}
                hitSlop={6}
              >
                <View style={[styles.checkbox, remember && styles.checkboxActive]}>
                  {remember ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : null}
                </View>
                <Text style={styles.checkLabel}>Lembrar de mim</Text>
              </Pressable>
              <Pressable hitSlop={6}>
                <Text style={styles.forgotText}>Esqueci minha senha</Text>
              </Pressable>
            </View>

            <PrimaryButton
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              style={{ marginTop: theme.spacing.xl }}
            >
              ENTRAR
            </PrimaryButton>

            {error && !errors.password ? (
              <Text style={styles.globalError}>
                Acesso negado. Verifique seus dados e tente novamente.
              </Text>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>ou continue com</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialRow}>
              <View style={styles.socialBtn}>
                <Text style={styles.socialGoogle}>G</Text>
              </View>
              <View style={styles.socialBtn}>
                <Apple size={20} color={theme.colors.foreground} />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não tem uma conta? </Text>
            <Pressable hitSlop={6}>
              <Text style={styles.footerLink}>Fale com sua igreja</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: height > 700 ? theme.spacing.xxxl : theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: height > 700 ? theme.spacing.xxxl : theme.spacing.lg,
  },
  logoGradient: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.gradientFrom,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  logoLetter: {
    color: theme.colors.foreground,
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    lineHeight: 52,
  },
  brandName: {
    color: theme.colors.foreground,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
    marginBottom: theme.spacing.md,
  },
  slogan1: {
    color: theme.colors.foregroundMuted,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 4,
  },
  slogan2: {
    color: theme.colors.foregroundMuted,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  welcomeTitle: {
    color: theme.colors.foreground,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
    marginBottom: theme.spacing.xs,
  },
  welcomeSubtitle: {
    color: theme.colors.foregroundMuted,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: theme.spacing.xl,
  },
  inputWrap: {
    marginBottom: theme.spacing.md,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.xs,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.foregroundMuted,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary500,
    borderColor: theme.colors.primary500,
  },
  checkmark: {
    color: theme.colors.foreground,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    lineHeight: 14,
  },
  checkLabel: {
    color: theme.colors.foregroundMuted,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  forgotText: {
    color: theme.colors.primary400,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  globalError: {
    marginTop: theme.spacing.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(240,68,56,0.12)",
    color: "#F04438",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "rgba(240,68,56,0.25)",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
  },
  dividerText: {
    color: theme.colors.foregroundMuted,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  socialBtn: {
    width: 52,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  socialGoogle: {
    color: theme.colors.foreground,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  footer: {
    marginTop: "auto",
    paddingTop: theme.spacing.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  footerText: {
    color: theme.colors.foregroundMuted,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  footerLink: {
    color: theme.colors.primary400,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
