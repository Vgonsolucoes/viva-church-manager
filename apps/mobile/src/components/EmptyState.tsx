import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Inbox,
  CalendarDays,
  Users,
  ClipboardCheck,
  HeartHandshake,
  Church,
  Briefcase,
  CalendarRange,
} from "lucide-react-native";
import { theme } from "@/theme";
import { PrimaryButton } from "./PrimaryButton";

type Tint = "default" | "info" | "agenda" | "cells" | "schedules";

const ICONS: Record<Tint, any> = {
  default: Inbox,
  info: Inbox,
  agenda: CalendarDays,
  cells: Users,
  schedules: ClipboardCheck,
};

const EXTRA_ICONS: Record<string, any> = {
  calendar: CalendarDays,
  user: Users,
  heart: HeartHandshake,
  church: Church,
  briefcase: Briefcase,
  clipboard: ClipboardCheck,
  calendarrange: CalendarRange,
  inbox: Inbox,
};

const COLORS: Record<Tint, { color: string; bg: string }> = {
  default: { color: theme.colors.foregroundMuted, bg: "rgba(143,164,191,0.12)" },
  info: { color: theme.colors.primary400, bg: "rgba(23,107,255,0.12)" },
  agenda: { color: theme.colors.purple400, bg: "rgba(112,87,255,0.12)" },
  cells: { color: theme.colors.green500, bg: "rgba(34,201,149,0.12)" },
  schedules: { color: theme.colors.cyan400, bg: "rgba(35,183,217,0.12)" },
};

interface EmptyStateProps {
  icon?: React.ComponentType<any> | string;
  title?: string;
  description?: string;
  tint?: Tint;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title = "Nada por aqui",
  description,
  tint = "default",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const c = COLORS[tint];
  let I: any = ICONS[tint];
  if (icon) {
    if (typeof icon === "string") {
      const key = icon.toLowerCase().replace(/[^a-z]/g, "");
      I = EXTRA_ICONS[key] ?? ICONS[tint];
    } else {
      I = icon;
    }
  }
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: c.bg }]}>
        <I size={40} color={c.color} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel ? (
        <View style={{ marginTop: theme.spacing.lg, width: 220, alignSelf: "center" }}>
          <PrimaryButton title={actionLabel} variant="solid" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xl,
  },
  icon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  title: { ...theme.typography.heading, color: "#FFFFFF", textAlign: "center" },
  desc: {
    ...theme.typography.bodySm,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
});
