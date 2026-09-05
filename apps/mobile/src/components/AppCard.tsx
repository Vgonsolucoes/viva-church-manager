import React from "react";
import { View, StyleSheet, Pressable, ViewStyle } from "react-native";
import { theme } from "@/theme";

type Variant = "default" | "hero" | "outlined" | "transparent";

interface AppCardProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padding?: number;
}

export function AppCard({
  children,
  variant = "default",
  style,
  contentStyle,
  onPress,
  padding,
}: AppCardProps) {
  const cardStyles = [
    styles.base,
    variant === "default" && styles.defaultVar,
    variant === "hero" && styles.heroVar,
    variant === "outlined" && styles.outlinedVar,
    variant === "transparent" && styles.transparentVar,
    style,
  ];

  const pad = padding ?? (variant === "hero" ? theme.spacing.xl : theme.spacing.lg);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyles,
          pressed && { opacity: 0.86, transform: [{ scale: 0.975 }] },
        ]}
      >
        <View style={[{ padding: pad }, contentStyle]}>{children}</View>
      </Pressable>
    );
  }

  return (
    <View style={cardStyles}>
      <View style={[{ padding: pad }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.card,
    width: "100%",
    overflow: "hidden",
  },
  defaultVar: {
    backgroundColor: theme.colors.card,
    borderWidth: 0.5,
    borderColor: theme.colors.cardOutline,
    ...theme.shadows.md,
  },
  heroVar: {
    backgroundColor: theme.colors.cardDark,
    borderRadius: theme.radius.cardHero,
    borderWidth: 0.6,
    borderColor: "rgba(71, 61, 255, 0.25)",
    ...theme.shadows.lg,
  },
  outlinedVar: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.white16,
  },
  transparentVar: { backgroundColor: "transparent" },
});
