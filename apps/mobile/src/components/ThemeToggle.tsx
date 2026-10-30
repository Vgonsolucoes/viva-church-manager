import React from "react";
import { Pressable, Text } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import { useAppTheme, useAppearance } from "@/theme";

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const theme = useAppTheme();
  const mode = useAppearance((state) => state.mode);
  const setMode = useAppearance((state) => state.setMode);
  const dark = mode === "dark";
  const Icon = dark ? Sun : Moon;
  const label = dark ? "Usar modo claro" : "Usar modo escuro";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      onPress={() => setMode(dark ? "light" : "dark")}
      style={({ pressed }) => ({ minWidth: 44, minHeight: 44, paddingHorizontal: 12,
        borderRadius: 12, flexDirection: "row", gap: 9, alignItems: "center",
        justifyContent: "center", backgroundColor: theme.colors.cardDark, opacity: pressed ? 0.7 : 1 })}>
      <Icon size={20} color={theme.colors.primary500} />
      {showLabel && <Text style={{ color: theme.colors.foreground, fontFamily: "Inter_500Medium" }}>{label}</Text>}
    </Pressable>
  );
}
