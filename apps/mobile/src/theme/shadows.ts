import { Platform, ViewStyle } from "react-native";

export const shadows = {
  sm: {
    ...Platform.select<ViewStyle>({
      ios: { shadowColor: "#000000", shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  md: {
    ...Platform.select<ViewStyle>({
      ios: { shadowColor: "#000000", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  lg: {
    ...Platform.select<ViewStyle>({
      ios: { shadowColor: "#184CFF", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 4 },
    }),
  },
  premium: {
    ...Platform.select<ViewStyle>({
      ios: { shadowColor: "#473DFF", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 6 },
    }),
  },
} as const;

export type AppShadows = typeof shadows;
