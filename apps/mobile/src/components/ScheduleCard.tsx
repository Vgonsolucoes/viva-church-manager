import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ClipboardList, Church, Music, Users, DollarSign, HeartHandshake, Baby } from "lucide-react-native";
import { theme } from "@/theme";
import { AppCard } from "./AppCard";
import { StatusBadge, ScheduleStatus } from "./StatusBadge";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";
import { Badge } from "./Badge";

export interface ScheduleCardData {
  id: string;
  title: string;
  dateLabel: string;
  timeRangeLabel: string;
  ministryLabel?: string;
  roleLabel?: string;
  status: ScheduleStatus;
  category?: "CULTO" | "ENSAIO" | "EVENTO" | "REUNIAO" | "KIDS" | "PROJETO" | "OUTRO";
  canConfirm?: boolean;
  canRefuse?: boolean;
  onMore?: () => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string; Icon: any }> = {
  CULTO: { bg: "rgba(23,107,255,0.14)", color: theme.colors.primary400, Icon: Church },
  ENSAIO: { bg: "rgba(112,87,255,0.14)", color: theme.colors.purple400, Icon: Music },
  EVENTO: { bg: "rgba(236,95,145,0.14)", color: theme.colors.pink500, Icon: HeartHandshake },
  REUNIAO: { bg: "rgba(35,183,217,0.14)", color: theme.colors.cyan400, Icon: Users },
  KIDS: { bg: "rgba(243,155,66,0.14)", color: theme.colors.orange500, Icon: Baby },
  PROJETO: { bg: "rgba(34,201,149,0.14)", color: theme.colors.green500, Icon: DollarSign },
  OUTRO: { bg: theme.colors.white08, color: theme.colors.foregroundMuted, Icon: ClipboardList },
};

interface ScheduleCardProps {
  data: ScheduleCardData;
  onConfirm?: () => void;
  onRefuse?: () => void;
  onView?: () => void;
}

export function ScheduleCard({ data, onConfirm, onRefuse, onView }: ScheduleCardProps) {
  const style = CATEGORY_STYLES[data.category ?? "OUTRO"] ?? CATEGORY_STYLES.OUTRO;
  const I = style.Icon;
  const showActions = data.status === "PENDING";

  return (
    <Pressable onPress={onView} style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
      <AppCard>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconBox, { backgroundColor: style.bg }]}>
              <I size={22} color={style.color} />
            </View>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text numberOfLines={1} style={styles.title}>
                {data.title}
              </Text>
              <Text style={styles.metaDateTime}>
                {data.dateLabel} {data.dateLabel && data.timeRangeLabel ? "•" : ""} {data.timeRangeLabel}
              </Text>
            </View>
          </View>
          <StatusBadge status={data.status} />
        </View>
        {data.ministryLabel || data.roleLabel ? (
          <View style={styles.metaRowMinistry}>
            {data.ministryLabel ? <Badge variant="muted" label={data.ministryLabel} /> : null}
            {data.roleLabel ? (
              <Badge variant="muted" label={data.roleLabel} style={{ marginLeft: theme.spacing.sm }} />
            ) : null}
          </View>
        ) : null}
        {showActions && (data.canConfirm || data.canRefuse) ? (
          <View style={styles.actionsRow}>
            {data.canConfirm ? (
              <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
                <PrimaryButton title="Confirmar" onPress={onConfirm} />
              </View>
            ) : null}
            {data.canRefuse ? (
              <View style={data.canConfirm ? { flex: 1 } : { flex: 1 }}>
                <SecondaryButton title="Recusar" variant="default" onPress={onRefuse} />
              </View>
            ) : null}
          </View>
        ) : null}
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  iconWrap: { flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: theme.spacing.md },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...theme.typography.card, color: "#FFFFFF" },
  metaDateTime: {
    ...theme.typography.subtle,
    color: theme.colors.foregroundMuted,
    marginTop: 4,
  },
  metaRowMinistry: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  actionsRow: {
    marginTop: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
});
