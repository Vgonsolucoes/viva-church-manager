import React from "react";
import { Pressable, Text, StyleSheet, View, ActivityIndicator, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@/theme";

type Variant = "solid" | "gradient" | "small";

interface PrimaryButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  leftIcon?: React.ReactNode;
  height?: number;
}

export function PrimaryButton({
  title,
  children,
  onPress,
  variant = "solid",
  disabled,
  loading,
  style,
  leftIcon,
  height,
}: PrimaryButtonProps) {
  const defaultHeight = variant === "small" ? 44 : 52;
  const h = height ?? defaultHeight;
  const label = children ?? title ?? "";

  const content = (pressed: boolean) => {
    const baseStyleArr: (ViewStyle | null)[] = [
      styles.base,
      { height: h },
      variant === "gradient" ? styles.transparentBg : null,
      disabled || loading ? styles.disabled : pressed ? styles.pressed : null,
    ];
    if (Array.isArray(style)) baseStyleArr.push(...style);
    else if (style) baseStyleArr.push(style);
    const baseStyle: ViewStyle[] = baseStyleArr.filter((v): v is ViewStyle => !!v);

    const textContent = typeof label === "string" ? (
      <Text
        style={[
          styles.text,
          variant === "small" && { fontSize: 14 },
          (disabled || loading) && { opacity: 0.7 },
        ]}
      >
        {label}
      </Text>
    ) : (
      label
    );

    const inner = (
      <>
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
        ) : leftIcon ? (
          <View style={{ marginRight: 8 }}>{leftIcon}</View>
        ) : null}
        {textContent}
      </>
    );

    if (variant === "gradient" && !disabled) {
      return (
        <LinearGradient
          colors={[theme.colors.gradientFrom, theme.colors.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={baseStyle}
        >
          <View style={styles.row}>{inner}</View>
        </LinearGradient>
      );
    }

    return (
      <View style={[...baseStyle, styles.rowBg]}>
        <View style={styles.row}>{inner}</View>
      </View>
    );
  };

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      android_ripple={{
        color: "rgba(255,255,255,0.10)",
        borderless: false,
        radius: theme.radius.button,
      }}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    backgroundColor: theme.colors.primary500,
    borderRadius: theme.radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  rowBg: { backgroundColor: theme.colors.primary500 },
  transparentBg: { backgroundColor: "transparent" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
  },
  text: {
    color: "#FFFFFF",
    ...theme.typography.button,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.975 }] },
  disabled: { opacity: 0.5 },
});
