import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  CalendarDays,
  Users,
  GraduationCap,
  Briefcase,
  HeartHandshake,
  HeartPulse,
  QrCode,
  Baby,
  CalendarRange,
  type LucideIcon,
} from "lucide-react-native";
import { theme } from "@/theme";

export type MinistryKey =
  | "events"
  | "cells"
  | "discipleships"
  | "ministries"
  | "projects"
  | "prayer"
  | "qr"
  | "kids"
  | "notifications";

const MAP: Record<MinistryKey, { label: string; Icon: LucideIcon; bgTint: string; bgTintAlpha: string; labelColor: string }> = {
  events: {
    label: "Eventos",
    Icon: CalendarDays,
    bgTint: theme.colors.purple500,
    bgTintAlpha: "rgba(112,87,255,0.14)",
    labelColor: "#FFFFFF",
  },
  cells: {
    label: "Células",
    Icon: Users,
    bgTint: theme.colors.green500,
    bgTintAlpha: "rgba(34,201,149,0.14)",
    labelColor: "#FFFFFF",
  },
  discipleships: {
    label: "Discipulado",
    Icon: GraduationCap,
    bgTint: theme.colors.cyan500,
    bgTintAlpha: "rgba(35,183,217,0.14)",
    labelColor: "#FFFFFF",
  },
  ministries: {
    label: "Ministérios",
    Icon: Briefcase,
    bgTint: theme.colors.orange500,
    bgTintAlpha: "rgba(243,155,66,0.14)",
    labelColor: "#FFFFFF",
  },
  projects: {
    label: "Projetos",
    Icon: HeartHandshake,
    bgTint: theme.colors.pink500,
    bgTintAlpha: "rgba(236,95,145,0.14)",
    labelColor: "#FFFFFF",
  },
  prayer: {
    label: "Oração",
    Icon: HeartPulse,
    bgTint: theme.colors.primary500,
    bgTintAlpha: "rgba(23,107,255,0.14)",
    labelColor: "#FFFFFF",
  },
  qr: {
    label: "QR Code",
    Icon: QrCode,
    bgTint: theme.colors.cyan400,
    bgTintAlpha: "rgba(77,208,232,0.14)",
    labelColor: "#FFFFFF",
  },
  kids: {
    label: "Infantil",
    Icon: Baby,
    bgTint: theme.colors.pink400,
    bgTintAlpha: "rgba(243,134,170,0.14)",
    labelColor: "#FFFFFF",
  },
  notifications: {
    label: "Notificações",
    Icon: CalendarRange,
    bgTint: theme.colors.purple400,
    bgTintAlpha: "rgba(151,130,255,0.14)",
    labelColor: "#FFFFFF",
  },
};

export interface MinistryCardProps {
  ministry: MinistryKey;
  onPress?: () => void;
}

export function MinistryCard({ ministry, onPress }: MinistryCardProps) {
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

const styles = StyleSheet.create({
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
});
