import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/theme";

type Variant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "cyan"
  | "orange"
  | "pink"
  | "muted";

const MAP: Record<Variant, { bg: string; color: string }> = {
  primary: { bg: "rgba(23,107,255,0.14)", color: theme.colors.primary400 },
  success: { bg: "rgba(34,201,149,0.14)", color: theme.colors.green500 },
  warning: { bg: "rgba(244,161,0,0.14)", color: theme.colors.warning500 },
  danger: { bg: "rgba(240,68,56,0.14)", color: theme.colors.danger500 },
  purple: { bg: "rgba(112,87,255,0.14)", color: theme.colors.purple400 },
  cyan: { bg: "rgba(35,183,217,0.14)", color: theme.colors.cyan400 },
  orange: { bg: "rgba(243,155,66,0.14)", color: theme.colors.orange500 },
  pink: { bg: "rgba(236,95,145,0.14)", color: theme.colors.pink500 },
  muted: { bg: theme.colors.white08, color: theme.colors.foregroundMuted },
};

export interface BadgeProps {
  label: string;
  variant?: Variant;
  style?: any;
}

export function Badge({ label, variant = "primary", style }: BadgeProps) {
  const m = MAP[variant];
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }, style]}>
      <Text style={[styles.label, { color: m.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    alignSelf: "flex-start",
  },
  label: {
    ...theme.typography.captionBold,
    letterSpacing: 0.4,
  },
});
