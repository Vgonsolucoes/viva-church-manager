import React from "react";
import { StyleSheet, View, StyleProp, ViewProps, ViewStyle } from "react-native";
import { theme } from "@/constants/theme";

export interface CardProps extends ViewProps {
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  padding?: "sm" | "md" | "lg" | "none";
}

export function Card({
  style,
  elevated = true,
  padding = "md",
  children,
  ...rest
}: CardProps) {
  const paddingStyle = padding === "none" ? null : styles[`pad_${padding}`];
  return (
    <View
      {...rest}
      style={[styles.card, elevated ? styles.elevated : null, paddingStyle, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  elevated: {
    // Note: React Native Shadow props added below via platform
  },
  pad_sm: { padding: 10 },
  pad_md: { padding: 14 },
  pad_lg: { padding: 18 },
});
