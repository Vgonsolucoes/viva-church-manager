import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Users,
  Crown,
  Church,
  HeartHandshake,
  Megaphone,
} from "lucide-react-native";
import { theme } from "@/theme";

export type NotificationType = "SCHEDULE" | "EVENT" | "CELL" | "LEADER" | "CULT" | "PROJECT" | "GENERAL";

export interface NotificationItemData {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  type: NotificationType;
  unread?: boolean;
}

const MAP: Record<NotificationType, { Icon: any; bg: string; color: string }> = {
  SCHEDULE: {
    Icon: CalendarCheck,
    bg: "rgba(23,107,255,0.14)",
    color: theme.colors.primary400,
  },
  EVENT: { Icon: CalendarDays, bg: "rgba(236,95,145,0.14)", color: theme.colors.pink500 },
  CELL: { Icon: Users, bg: "rgba(34,201,149,0.14)", color: theme.colors.green500 },
  LEADER: { Icon: Crown, bg: "rgba(243,155,66,0.14)", color: theme.colors.orange500 },
  CULT: { Icon: Church, bg: "rgba(112,87,255,0.14)", color: theme.colors.purple400 },
  PROJECT: { Icon: HeartHandshake, bg: "rgba(35,183,217,0.14)", color: theme.colors.cyan400 },
  GENERAL: { Icon: Megaphone, bg: theme.colors.white08, color: theme.colors.foregroundMuted },
};

interface NotificationItemProps {
  data: NotificationItemData;
  onPress?: () => void;
}

export function NotificationItem({ data, onPress }: NotificationItemProps) {
  const m = MAP[data.type] ?? MAP.GENERAL;
  const I = m.Icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: m.bg }]}>
        <I size={22} color={m.color} />
      </View>
      <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
        <Text numberOfLines={1} style={styles.title}>
          {data.title}
        </Text>
        <Text numberOfLines={2} style={styles.desc}>
          {data.description}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.time}>{data.timeLabel}</Text>
        {data.unread ? <View style={styles.unreadDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.card,
    borderWidth: 0.5,
    borderColor: theme.colors.cardOutline,
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...theme.typography.bodyBold, color: "#FFFFFF" },
  desc: { ...theme.typography.subtle, color: theme.colors.foregroundMuted, marginTop: 3 },
  time: { ...theme.typography.caption, color: theme.colors.foregroundMuted },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary500,
    marginTop: 8,
    alignSelf: "flex-end",
  },
});
