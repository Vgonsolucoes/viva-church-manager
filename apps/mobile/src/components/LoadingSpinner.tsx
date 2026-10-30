import React from "react";
import { ActivityIndicator, View, ViewStyle, StyleProp } from "react-native";
import { useAppTheme } from "@/constants/theme";

export function LoadingSpinner({
  size = "small",
  color,
  style,
}: {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={style} pointerEvents="none">
      <ActivityIndicator size={size} color={color ?? theme.colors.primary} />
    </View>
  );
}
