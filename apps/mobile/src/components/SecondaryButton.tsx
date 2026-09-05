import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, View, ActivityIndicator } from "react-native";
import { theme } from "@/theme";

type Variant = "default" | "ghost" | "transparent" | "outline";

interface SecondaryButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  height?: number;
  textStyle?: any;
  leftIcon?: React.ReactNode;
}

export function SecondaryButton({
  title,
  children,
  onPress,
  variant = "default",
  disabled,
  loading,
  style,
  height = 48,
  textStyle,
  leftIcon,
}: SecondaryButtonProps) {
  const label = children ?? title ?? "";
  const styleArray = Array.isArray(style) ? style : [style];
  const base: ViewStyle[] = [
    styles.base,
    { height },
    variant === "default" ? styles.defaultVar : null,
    variant === "ghost" ? styles.ghostVar : null,
    variant === "outline" ? styles.outlineVar : null,
    variant === "transparent" ? styles.transparentVar : null,
    ...styleArray,
  ].filter((v): v is ViewStyle => !!v);

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        base,
        disabled ? styles.disabled : pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.foreground} style={{ marginRight: 8 }} />
        ) : leftIcon ? (
          <View style={{ marginRight: 8 }}>{leftIcon}</View>
        ) : null}
        {typeof label === "string" ? (
          <Text
            style={[
              styles.text,
              variant === "ghost" && { color: theme.colors.primary400 },
              (disabled || loading) && { opacity: 0.7 },
              textStyle,
            ]}
          >
            {label}
          </Text>
        ) : (
          label
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: theme.radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  defaultVar: {
    backgroundColor: theme.colors.card,
    borderWidth: 0.6,
    borderColor: theme.colors.white16,
  },
  ghostVar: { backgroundColor: "rgba(23,107,255,0.10)" },
  outlineVar: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.white16,
  },
  transparentVar: { backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  text: {
    color: "#FFFFFF",
    ...theme.typography.button,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.975 }] },
  disabled: { opacity: 0.45 },
});
