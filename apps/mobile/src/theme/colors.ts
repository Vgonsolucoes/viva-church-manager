export const lightColors = {
  background: "#F5F0EC", backgroundSecondary: "#EEE5DE", card: "#FFFFFF", cardDark: "#F0E7E0",
  foreground: "#302922", foregroundMuted: "#6F6056", onPrimary: "#FFFFFF",
  primary500: "#76503B", primary400: "#80583F", primary300: "#9C6F54",
  gradientFrom: "#76503B", gradientTo: "#895E45",
  purple500: "#76503B", purple400: "#80583F", cyan500: "#76503B", cyan400: "#80583F",
  green500: "#526442", green400: "#526442", orange500: "#886025", orange400: "#886025",
  pink500: "#76503B", pink400: "#80583F", danger500: "#B3352D", danger400: "#B3352D",
  warning500: "#886025", warning400: "#886025", success500: "#526442",
  borderSubtle: "#E7DDD5", borderPrimary: "#E9DBD0", cardOutline: "#E7DDD5",
  white08: "rgba(118,80,59,0.06)", white16: "rgba(118,80,59,0.12)",
  overlayDark: "rgba(25,22,20,0.72)", overlaySoft: "rgba(25,22,20,0.40)",
  skeletonBase: "#E7DDD5", skeletonHighlight: "#F0E7E0",
};
export type AppColors = typeof lightColors;
export const darkColors: AppColors = {
  ...lightColors,
  background: "#191614", backgroundSecondary: "#211C18", card: "#24201D", cardDark: "#2D2621",
  foreground: "#F5F0EC", foregroundMuted: "#C2B2A6", onPrimary: "#271B14",
  primary500: "#D4AA8B", primary400: "#D4AA8B", primary300: "#E1BEA3",
  gradientFrom: "#D4AA8B", gradientTo: "#C99A77",
  purple500: "#D4AA8B", purple400: "#D4AA8B", cyan500: "#D4AA8B", cyan400: "#D4AA8B",
  green500: "#BED0AA", green400: "#BED0AA", orange500: "#E0BB81", orange400: "#E0BB81",
  pink500: "#D4AA8B", pink400: "#D4AA8B", danger500: "#FFADA2", danger400: "#FFADA2",
  warning500: "#E0BB81", warning400: "#E0BB81", success500: "#BED0AA",
  borderSubtle: "#443930", borderPrimary: "#4C392B", cardOutline: "#443930",
  white08: "rgba(245,240,236,0.06)", white16: "rgba(245,240,236,0.12)",
  skeletonBase: "#362C25", skeletonHighlight: "#493A30",
};
export const colors = lightColors;
