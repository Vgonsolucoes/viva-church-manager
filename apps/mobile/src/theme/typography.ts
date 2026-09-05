export const fontFamilies = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const typography = {
  titleLg: {
    fontFamily: fontFamilies.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.2,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.1,
  },
  heading: {
    fontFamily: fontFamilies.semibold,
    fontSize: 20,
    lineHeight: 26,
  },
  section: {
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  card: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyBold: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySm: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bodySmBold: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  subtle: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  subtleBold: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  captionBold: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  tabLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 14,
  },
} as const;

export type AppTypography = typeof typography;
export type AppFontFamilies = typeof fontFamilies;
