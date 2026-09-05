import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MapPin } from "lucide-react-native";
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
import { AppHeader } from "@/components/AppHeader";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppCard } from "@/components/AppCard";
import { Badge } from "@/components/Badge";
import { LoadingSkeleton, SkeletonCardLines } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

type Range = "today" | "week" | "month";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function categoryMeta(cat: AgendaCategory): {
  label: string;
  icon: IconName;
  color: string;
  bg: string;
  variant: any;
} {
  switch (cat) {
    case "CULTO":
      return { label: "Culto", icon: "church", color: theme.colors.primary, bg: theme.colors.primarySoft, variant: "primary" };
    case "EVENTO":
      return { label: "Evento", icon: "calendar-star", color: theme.colors.accent, bg: theme.colors.accentSoft, variant: "pink" };
    case "CELULA":
      return { label: "Célula", icon: "account-group", color: theme.colors.success, bg: "rgba(23,201,100,0.15)", variant: "success" };
    case "REUNIAO":
      return { label: "Reunião", icon: "account-multiple-check", color: theme.colors.secondary, bg: "rgba(57,75,107,0.15)", variant: "cyan" };
    case "DISCIPULADO":
      return { label: "Discipulado", icon: "book-open-page-variant", color: theme.colors.warning, bg: "rgba(244,161,0,0.15)", variant: "warning" };
    case "ENSAIO":
      return { label: "Ensaio", icon: "music-circle", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)", variant: "purple" };
    case "ESCALA":
      return { label: "Escala", icon: "clipboard-text-clock", color: "#0EA5E9", bg: "rgba(14,165,233,0.15)", variant: "cyan" };
    case "CONFERENCIA":
      return { label: "Conferência", icon: "microphone-variant", color: "#EC4899", bg: "rgba(236,72,153,0.15)", variant: "pink" };
    default:
      return { label: "Agenda", icon: "calendar", color: theme.colors.primary, bg: theme.colors.primarySoft, variant: "primary" };
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

  const handleSearch = () => {};
  const handleFilter = () => {};

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Agenda"
        rightIcons={[
          { key: "search", onPress: handleSearch },
          { key: "filter", onPress: handleFilter },
        ]}
      />

      <View style={styles.tabsWrap}>
        <SegmentedControl value={range} onChange={setRange} />
      </View>

      <ScreenContainer
        scrollable={true}
        padded={true}
        edges={["left", "right", "bottom"]}
        noTopPadding={true}
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
      >
        {error && !isLoading ? (
          <ErrorState
            title="Erro ao carregar agenda"
            message={(error as Error).message || "Arraste para atualizar."}
            onRetry={onRefresh}
          />
        ) : null}

        {isLoading ? (
          <TimelineSkeleton />
        ) : items.length === 0 ? (
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
            tint="agenda"
          />
        ) : (
          <TimelineList items={items} onAddToCalendar={handleAddToCalendar} />
        )}

        <View style={{ height: 24 }} />
      </ScreenContainer>
    </View>
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
              style={({ pressed }) => [
                styles.segBtn,
                active && styles.segBtnActive,
                pressed && { opacity: 0.8 },
              ]}
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

function TimelineSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 70, alignItems: "flex-end", paddingTop: 6 }}>
            <LoadingSkeleton variant="line" width={52} height={16} />
          </View>
          <View style={{ flex: 1 }}>
            <LoadingSkeleton variant="card" height={100} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TimelineList({
  items,
  onAddToCalendar,
}: {
  items: AgendaItem[];
  onAddToCalendar: (item: AgendaItem) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    items.forEach((it) => {
      const key = formatDate(it.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <View style={{ gap: 18 }}>
      {grouped.map(([dayKey, dayItems]) => (
        <View key={dayKey}>
          <Text style={styles.dayHeader}>{dayKey}</Text>
          <View style={{ marginTop: 10, gap: 14 }}>
            {dayItems.map((item) => (
              <TimelineRow key={item.id} item={item} onAddToCalendar={onAddToCalendar} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TimelineRow({
  item,
  onAddToCalendar,
}: {
  item: AgendaItem;
  onAddToCalendar: (item: AgendaItem) => void;
}) {
  const meta = categoryMeta(item.category);
  const time = formatTime(item.startsAt);

  return (
    <View style={{ flexDirection: "row" }}>
      <View style={styles.timeCol}>
        <Text style={styles.timeLabel}>{time}</Text>
      </View>

      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={styles.separatorCol}>
          <View style={styles.separatorDot} />
          <View style={styles.separatorLine} />
        </View>

        <View style={{ flex: 1, paddingLeft: 12 }}>
          <AppCard variant="default" padding={undefined}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={styles.itemTitle}>
                    {item.title}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <Badge label={meta.label} variant={meta.variant as any} />
                  </View>
                </View>
                <View
                  style={[
                    styles.itemIconBox,
                    { backgroundColor: "rgba(255,255,255,0.06)" },
                  ]}
                >
                  <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
                </View>
              </View>

              {item.location ? (
                <View style={styles.itemMetaRow}>
                  <MapPin size={14} color={theme.colors.foregroundMuted} />
                  <Text style={styles.itemMetaText} numberOfLines={1}>
                    {item.location}
                  </Text>
                </View>
              ) : null}

              {item.description ? (
                <Text style={styles.itemDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <Pressable
                style={styles.itemActionBtn}
                onPress={() => onAddToCalendar(item)}
              >
                <MaterialCommunityIcons name="calendar-plus" size={14} color={theme.colors.primary400} />
                <Text style={styles.itemActionText}>Adicionar à agenda</Text>
              </Pressable>
            </View>
          </AppCard>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  segRoot: {
    width: "100%",
  },
  segBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white08,
    borderWidth: 1,
    borderColor: theme.colors.white16,
  },
  segBtnActive: {
    backgroundColor: theme.colors.primary500,
    borderColor: theme.colors.primary500,
  },
  segText: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 13,
  },
  segTextActive: {
    color: "#FFFFFF",
  },
  dayHeader: {
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 16,
    marginTop: 4,
  },
  timeCol: {
    width: 70,
    alignItems: "flex-end",
    paddingRight: 4,
    paddingTop: 6,
  },
  timeLabel: {
    color: theme.colors.primary400,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 14,
    textAlign: "right",
  },
  separatorCol: {
    width: 18,
    alignItems: "center",
  },
  separatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary400,
    marginTop: 12,
  },
  separatorLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: theme.colors.white08,
    marginTop: 6,
    minHeight: 80,
  },
  itemTitle: {
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  itemIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemMetaText: {
    flex: 1,
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
    fontSize: 12,
  },
  itemDesc: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  itemActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(23,107,255,0.10)",
    marginTop: 2,
  },
  itemActionText: {
    color: theme.colors.primary400,
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 11,
  },
});

void formatDate;
void formatTime;
void Screen;
void Card;
void LoadingSpinner;
