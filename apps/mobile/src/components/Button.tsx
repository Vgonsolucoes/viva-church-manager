import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  PressableProps,
} from "react-native";
import { theme } from "@/constants/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  fullWidth,
  style,
  children,
  leftIcon,
  rightIcon,
  ...rest
}: ButtonProps) {
  const rootStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth ? styles.full : null,
    (disabled || loading) ? styles.disabled : null,
    style,
  ];
  const textColor =
    variant === "primary" || variant === "destructive" || variant === "secondary"
      ? styles.textLight
      : styles.textDark;
  const textSize = styles[`text_${size}`];
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        ...(Array.isArray(rootStyle) ? rootStyle : [rootStyle]),
        pressed && !disabled && !loading ? styles.pressed : null,
      ]}
      android_ripple={{ color: theme.colors.overlay, borderless: false }}
    >
      {loading ? (
        <View style={styles.contentRow}>
          <ActivityIndicator
            color={
              variant === "ghost" || variant === "outline"
                ? theme.colors.primary
                : "#FFFFFF"
            }
          />
        </View>
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          {typeof children === "string" ? (
            <Text style={[styles.text, textColor, textSize]}>{children}</Text>
          ) : (
            <>{children}</>
          )}
          {rightIcon ? <View style={[styles.icon, { marginLeft: 0, marginRight: -4 }]}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  size_sm: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
  size_md: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 },
  size_lg: { paddingVertical: 14, paddingHorizontal: 20, minHeight: 56 },
  full: { width: "100%" },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  contentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { marginLeft: -4 },
  text: { fontWeight: "600", letterSpacing: 0.2 },
  textLight: { color: "#FFFFFF" },
  textDark: { color: theme.colors.foregroundDark },
  text_sm: { fontSize: theme.font.sm },
  text_md: { fontSize: theme.font.md },
  text_lg: { fontSize: theme.font.lg },
  variant_primary: {
    backgroundColor: theme.colors.primary,
  },
  variant_secondary: {
    backgroundColor: theme.colors.secondary,
  },
  variant_outline: {
    backgroundColor: "transparent",
    borderColor: theme.colors.border,
  },
  variant_ghost: {
    backgroundColor: "transparent",
  },
  variant_destructive: {
    backgroundColor: theme.colors.destructive,
  },
});
