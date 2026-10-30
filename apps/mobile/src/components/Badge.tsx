import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme";
import { useThemedStyles } from "@/theme";

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

const createMAP = (theme: ReturnType<typeof useAppTheme>): Record<Variant, { bg: string; color: string }> => ({
  primary: { bg: theme.colors.borderPrimary, color: theme.colors.primary400 },
  success: { bg: theme.colors.borderPrimary, color: theme.colors.green500 },
  warning: { bg: "rgba(244,161,0,0.14)", color: theme.colors.warning500 },
  danger: { bg: "rgba(240,68,56,0.14)", color: theme.colors.danger500 },
  purple: { bg: theme.colors.borderPrimary, color: theme.colors.purple400 },
  cyan: { bg: theme.colors.borderPrimary, color: theme.colors.cyan400 },
  orange: { bg: theme.colors.borderPrimary, color: theme.colors.orange500 },
  pink: { bg: theme.colors.borderPrimary, color: theme.colors.pink500 },
  muted: { bg: theme.colors.white08, color: theme.colors.foregroundMuted },
});

export interface BadgeProps {
  label: string;
  variant?: Variant;
  style?: any;
}

export function Badge({ label, variant = "primary", style }: BadgeProps) {
  const theme = useAppTheme();
  const MAP = useThemedStyles(createMAP, theme);
  const styles = useThemedStyles(createStyles, theme);

  const m = MAP[variant];
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }, style]}>
      <Text style={[styles.label, { color: m.color }]}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => (StyleSheet.create({
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
}));
