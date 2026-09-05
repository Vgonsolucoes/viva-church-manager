import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AlertTriangle, RefreshCw } from "lucide-react-native";
import { theme } from "@/theme";
import { SecondaryButton } from "./SecondaryButton";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "Algo deu errado",
  message = "Não foi possível carregar os dados. Tente novamente.",
  onRetry,
  retryLabel = "Tentar novamente",
}: ErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <AlertTriangle size={36} color={theme.colors.danger500} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.desc}>{message}</Text> : null}
      {onRetry ? (
        <View style={{ marginTop: theme.spacing.lg, minWidth: 220 }}>
          <SecondaryButton
            title={retryLabel}
            leftIcon={<RefreshCw size={16} color={theme.colors.primary400} />}
            onPress={onRetry}
            variant="ghost"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xl,
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(240,68,56,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  title: { ...theme.typography.heading, color: "#FFFFFF", textAlign: "center" },
  desc: {
    ...theme.typography.bodySm,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
});
