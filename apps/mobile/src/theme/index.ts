export * from "./colors";
export * from "./spacing";
export * from "./radius";
export * from "./shadows";
export * from "./typography";
import { colors } from "./colors";
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
