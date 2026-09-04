import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle, StyleProp } from "react-native";
import { theme } from "@/constants/theme";
import { initialsFromName } from "@/utils/date";

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ src, name, size = 44, style }: AvatarProps) {
  const initials = initialsFromName(name);
  const r = size / 2;
  const sizeStyle = { width: size, height: size, borderRadius: r };
  if (src && typeof src === "string" && src.length > 0) {
    return (
      <View style={[sizeStyle, styles.shadow, style]}>
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size, borderRadius: r }}
          resizeMode="cover"
        />
      </View>
    );
  }
  return (
    <View style={[sizeStyle, styles.fallback, style]}>
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: Math.max(11, Math.round(size * 0.38)),
          fontWeight: "700",
        }}
      >
        {initials || "VC"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    overflow: "hidden",
  },
  fallback: {
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
