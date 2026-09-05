import React from "react";
import { View, Image, Text, StyleSheet, ViewStyle } from "react-native";
import { theme } from "@/theme";

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

const SIZE_MAP: Record<Size, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 64,
  xl: 88,
  xxl: 120,
};

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: Size | number;
  ringColor?: string | null;
  ringWidth?: number;
  showOnline?: boolean;
  style?: ViewStyle;
  fallbackTint?: string;
}

function initialsOf(name?: string | null) {
  if (!name) return "VC";
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "VC";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "VC";
}

export function Avatar({
  src,
  name,
  size = "md",
  ringColor,
  ringWidth = 2.5,
  showOnline,
  style,
  fallbackTint,
}: AvatarProps) {
  const sizePx: number = typeof size === "number" ? size : SIZE_MAP[size];
  const ring = ringColor ? { borderColor: ringColor, borderWidth: ringWidth } : null;
  const tint = fallbackTint ?? theme.colors.primary500;
  return (
    <View style={[{ position: "relative" }, style]}>
      <View
        style={[
          styles.ringWrap,
          { width: sizePx, height: sizePx, borderRadius: sizePx / 2 },
          ring,
        ]}
      >
        {src ? (
          <Image
            source={{ uri: src }}
            style={{ width: "100%", height: "100%", borderRadius: sizePx / 2 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.fallback,
              { borderRadius: sizePx / 2, backgroundColor: tint, width: "100%", height: "100%" },
            ]}
          >
            <Text style={[styles.initials, { fontSize: Math.max(10, sizePx / 3.2) }]}>
              {initialsOf(name)}
            </Text>
          </View>
        )}
      </View>
      {showOnline ? <View style={[styles.online, { right: 0, bottom: 0 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ringWrap: { overflow: "hidden", backgroundColor: theme.colors.card },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFFFFF", fontFamily: theme.fontFamilies.bold, letterSpacing: 0.4 },
  online: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.green500,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
});
