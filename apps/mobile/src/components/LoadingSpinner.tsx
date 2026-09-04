import React from "react";
import { ActivityIndicator, View, ViewStyle, StyleProp } from "react-native";
import { theme } from "@/constants/theme";

export function LoadingSpinner({
  size = "small",
  color = theme.colors.primary,
  style,
}: {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style} pointerEvents="none">
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}
