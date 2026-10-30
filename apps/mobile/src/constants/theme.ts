import { theme as newTheme } from "@/theme";
import { useAppTheme as useBaseTheme, darkTheme } from "@/theme";
export type { AppTheme, AppColors, AppSpacing, AppRadius, AppShadows, AppTypography, AppFontFamilies } from "@/theme";

const createLegacyTheme = (newTheme: typeof import("@/theme").theme) => ({
  ...newTheme,
  colors: {
    ...newTheme.colors,
    background: newTheme.colors.background,
    backgroundSoft: newTheme.colors.backgroundSecondary,
    backgroundCard: newTheme.colors.card,
    muted: newTheme.colors.foregroundMuted,
    border: newTheme.colors.borderSubtle,
    foreground: newTheme.colors.foreground,
    foregroundDark: newTheme.colors.foreground,
    primary: newTheme.colors.primary500,
    primarySoft: newTheme.colors.borderPrimary,
    secondary: newTheme.colors.cardDark,
    destructive: newTheme.colors.danger500,
    destructiveSoft: "rgba(240,68,56,0.12)",
    success: newTheme.colors.green500,
    warning: newTheme.colors.warning500,
    accent: newTheme.colors.pink500,
    accentSoft: "rgba(236,95,145,0.12)",
    overlay: newTheme.colors.overlayDark,
  },
  font: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
  },
} as const);
export const theme = createLegacyTheme(newTheme);
const legacyDarkTheme = createLegacyTheme(darkTheme);
export function useAppTheme() {
  return useBaseTheme() === darkTheme ? legacyDarkTheme : theme;
}

