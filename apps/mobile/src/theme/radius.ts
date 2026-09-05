export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  card: 16,
  cardHero: 20,
  button: 12,
  input: 12,
  pill: 999,
} as const;

export type AppRadius = typeof radius;
