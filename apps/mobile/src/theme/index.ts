export * from "./colors";
export * from "./spacing";
export * from "./radius";
export * from "./shadows";
export * from "./typography";
import { colors } from "./colors";
import { darkColors } from "./colors";
import { useAppearance } from "./appearance";
export { useAppearance, useThemedStyles, useHydrateAppearance } from "./appearance";
import { spacing } from "./spacing";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { typography, fontFamilies } from "./typography";

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  fontFamilies,
} as const;

export type AppTheme = typeof theme;
export const darkTheme: AppTheme = { ...theme, colors: darkColors };
export function useAppTheme(): AppTheme {
  return useAppearance((state) => state.mode) === "dark" ? darkTheme : theme;
}
