import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  CalendarDays,
  Church,
  Users,
  GraduationCap,
  Briefcase,
  HeartHandshake,
  HeartPulse,
  QrCode,
  Baby,
  Car,
  Megaphone,
  CalendarRange,
  Ticket,
  type LucideIcon,
} from "lucide-react-native";
import { useAppTheme } from "@/theme";
import { useThemedStyles } from "@/theme";

export type MinistryKey =
  | "services"
  | "events"
  | "raffles"
  | "cells"
  | "discipleships"
  | "ministries"
  | "projects"
  | "prayer"
  | "qr"
  | "kids"
  | "notifications"
  | "parking"
  | "kidsProjection";

const createMAP = (theme: ReturnType<typeof useAppTheme>): Record<MinistryKey, { label: string; Icon: LucideIcon; bgTint: string; bgTintAlpha: string; labelColor: string }> => ({
  services: { label: "Cultos Fixos", Icon: Church, bgTint: theme.colors.primary500, bgTintAlpha: theme.colors.borderPrimary, labelColor: theme.colors.foreground },
  raffles: { label: "Sorteio", Icon: Ticket, bgTint: theme.colors.primary500, bgTintAlpha: theme.colors.borderPrimary, labelColor: theme.colors.foreground },
  events: {
    label: "Eventos",
    Icon: CalendarDays,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  cells: {
    label: "Células",
    Icon: Users,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  discipleships: {
    label: "Discipulado",
    Icon: GraduationCap,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  ministries: {
    label: "Ministérios",
    Icon: Briefcase,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  projects: {
    label: "Projetos",
    Icon: HeartHandshake,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  prayer: {
    label: "Oração",
    Icon: HeartPulse,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  qr: {
    label: "QR Code",
    Icon: QrCode,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  kids: {
    label: "Infantil",
    Icon: Baby,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
  parking: { label: "Estacionamento", Icon: Car, bgTint: theme.colors.primary500, bgTintAlpha: theme.colors.borderPrimary, labelColor: theme.colors.foreground },
  kidsProjection: { label: "Avisos Kids", Icon: Megaphone, bgTint: theme.colors.primary500, bgTintAlpha: theme.colors.borderPrimary, labelColor: theme.colors.foreground },
  notifications: {
    label: "Notificações",
    Icon: CalendarRange,
    bgTint: theme.colors.primary500,
    bgTintAlpha: theme.colors.borderPrimary,
    labelColor: theme.colors.foreground,
  },
});

export interface MinistryCardProps {
  ministry: MinistryKey;
  onPress?: () => void;
}

export function MinistryCard({ ministry, onPress }: MinistryCardProps) {
  const theme = useAppTheme();
  const MAP = useThemedStyles(createMAP, theme);
  const styles = useThemedStyles(createStyles, theme);

  const m = MAP[ministry];
  const I = m.Icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        pressed && { opacity: 0.82, transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: m.bgTintAlpha }]}>
        <I size={30} color={m.bgTint} strokeWidth={2.1} />
      </View>
      <Text numberOfLines={1} style={[styles.label, { color: m.labelColor }]}>
        {m.label}
      </Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => (StyleSheet.create({
  wrap: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    borderWidth: 0.5,
    borderColor: theme.colors.cardOutline,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    ...theme.shadows.md,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.bodyBold,
    fontSize: 14,
  },
}));
