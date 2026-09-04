import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { friendlyEventDate, formatDate, formatTime } from "@/utils/date";
import { addToCalendar } from "@/utils/calendar";
import { listMyAgenda } from "@/services/api/agenda";
import { useAuth } from "@/hooks/useAuth";
import type { AgendaCategory, AgendaItem } from "@/types";

type Range = "today" | "week" | "month";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function categoryMeta(cat: AgendaCategory): {
  label: string;
  icon: IconName;
  color: string;
  bg: string;
} {
  switch (cat) {
    case "CULTO":
      return { label: "Culto", icon: "church", color: theme.colors.primary, bg: theme.colors.primarySoft };
    case "EVENTO":
      return { label: "Evento", icon: "calendar-star", color: theme.colors.accent, bg: theme.colors.accentSoft };
    case "CELULA":
      return { label: "Célula", icon: "account-group", color: theme.colors.success, bg: "rgba(23,201,100,0.15)" };
    case "REUNIAO":
      return { label: "Reunião", icon: "account-multiple-check", color: theme.colors.secondary, bg: "rgba(57,75,107,0.15)" };
    case "DISCIPULADO":
      return { label: "Discipulado", icon: "book-open-page-variant", color: theme.colors.warning, bg: "rgba(244,161,0,0.15)" };
    case "ENSAIO":
      return { label: "Ensaio", icon: "music-circle", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)" };
    case "ESCALA":
      return { label: "Escala", icon: "clipboard-text-clock", color: "#0EA5E9", bg: "rgba(14,165,233,0.15)" };
    case "CONFERENCIA":
      return { label: "Conferência", icon: "microphone-variant", color: "#EC4899", bg: "rgba(236,72,153,0.15)" };
    default:
      return { label: "Agenda", icon: "calendar", color: theme.colors.primary, bg: theme.colors.primarySoft };
  }
}

const RANGE_TABS: { key: Range; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
];

export default function AgendaScreen() {
  const { initialized } = useAuth();
  const [range, setRange] = useState<Range>("today");

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["my-agenda", range],
    queryFn: () => listMyAgenda({ range }),
    enabled: initialized,
    staleTime: 60_000,
  });

  const items = useMemo(
    () => [...(data ?? [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [data],
  );

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleAddToCalendar = async (item: AgendaItem) => {
    const result = await addToCalendar({
      title: item.title,
      startDate: item.startsAt,
      endDate: item.endsAt,
      location: item.location,
      notes: item.description ?? undefined,
    });
    if (result.ok) {
      Alert.alert("Adicionado", "Evento salvo no seu calendário.");
    } else {
      Alert.alert("Ops", result.error ?? "Não foi possível adicionar.");
    }
  };

  return (
    <Screen
      backgroundBrand
      padded={false}
      loading={isLoading}
      loadingLabel="Carregando agenda..."
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
    >
      <View style={styles.header}>
        <SegmentedControl value={range} onChange={setRange} />
      </View>

      {error && !isLoading ? (
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons name="alert-circle" size={18} color={theme.colors.destructive} />
          <Text style={styles.errorText}>
            {(error as Error).message || "Erro ao carregar agenda. Arraste para atualizar."}
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {!isLoading && items.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Nada na agenda"
            description={
              range === "today"
                ? "Hoje não há compromissos agendados."
                : range === "week"
                  ? "Nesta semana não há compromissos agendados."
                  : "Este mês não há compromissos agendados."
            }
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        ) : null}

        {isLoading && items.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 30 }}>
            <LoadingSpinner size="large" />
          </View>
        ) : null}

        {items.map((item) => {
          const meta = categoryMeta(item.category);
          return (
            <Card key={item.id} style={styles.rowCard} padding="md" elevated>
              <View style={styles.rowHeader}>
                <View style={[styles.rowIconWrap, { backgroundColor: meta.bg }]}>
                  <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.rowTitleRow}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View
                      style={[styles.badge, { backgroundColor: meta.bg }]}
                    >
                      <Text style={[styles.badgeText, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.primary} />
                    <Text style={styles.rowDate}>{friendlyEventDate(item.startsAt)}</Text>
                  </View>
                  {item.location ? (
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.colors.muted} />
                      <Text style={styles.rowLocation} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  ) : null}
                  {item.description ? (
                    <Text style={styles.rowDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => handleAddToCalendar(item)}
                      android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
                    >
                      <MaterialCommunityIcons name="calendar-plus" size={16} color={theme.colors.primary} />
                      <Text style={styles.actionText}>Adicionar à agenda</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <View style={{ height: 20 }} />
    </Screen>
  );
}

function SegmentedControl({
  value,
  onChange,
}: {
  value: Range;
  onChange: (v: Range) => void;
}) {
  return (
    <View style={styles.segRoot}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {RANGE_TABS.map((t) => {
          const active = t.key === value;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: true }}
              style={[styles.segBtn, active && styles.segBtnActive]}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  segRoot: {
    width: "100%",
  },
  segBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  segBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  segText: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
    fontSize: theme.font.sm,
  },
  segTextActive: {
    color: "#FFFFFF",
  },
  errorWrap: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: theme.colors.destructiveSoft,
    borderWidth: 1,
    borderColor: "rgba(240,68,56,0.25)",
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: theme.colors.destructive,
    fontSize: theme.font.sm,
    fontWeight: "600",
  },
  list: {
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  rowCard: {
    width: "100%",
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: theme.font.md,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  rowDate: {
    fontSize: theme.font.sm,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  rowLocation: {
    flex: 1,
    fontSize: theme.font.xs,
    color: theme.colors.muted,
  },
  rowDesc: {
    marginTop: 8,
    fontSize: theme.font.sm,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
  },
  actionText: {
    fontSize: theme.font.xs,
    fontWeight: "700",
    color: theme.colors.primary,
  },
});

void formatDate;
void formatTime;
