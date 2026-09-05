import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { NotificationItem, type NotificationItemData, type NotificationType } from "@/components/NotificationItem";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { theme } from "@/theme";
import { listar } from "@/services/api/notifications";
import { formatDate } from "@/utils/date";

type TabKey = "all" | "schedules" | "events" | "community";

interface TabDef {
  key: TabKey;
  label: string;
}

const TABS: TabDef[] = [
  { key: "all", label: "Todas" },
  { key: "schedules", label: "Escalas" },
  { key: "events", label: "Eventos" },
  { key: "community", label: "Comunidade" },
];

function matchesTab(type: NotificationType | string, tab: TabKey): boolean {
  if (tab === "all") return true;
  switch (tab) {
    case "schedules":
      return type === "SCHEDULE";
    case "events":
      return type === "EVENT" || type === "CULT";
    case "community":
      return type === "CELL" || type === "LEADER" || type === "PROJECT" || type === "GENERAL";
  }
  return false;
}

function normalise(raw: unknown, idx: number): NotificationItemData {
  const item = (raw ?? {}) as Record<string, any>;
  const typeRaw = String(item.type ?? item.category ?? "GENERAL").toUpperCase();
  const validType: NotificationType = (["SCHEDULE", "EVENT", "CELL", "LEADER", "CULT", "PROJECT", "GENERAL"] as NotificationType[]).includes(
    typeRaw as NotificationType
  )
    ? (typeRaw as NotificationType)
    : "GENERAL";
  const created = item.createdAt ? new Date(item.createdAt) : new Date(Date.now() - idx * 60_000);
  return {
    id: String(item.id ?? `n-${idx}`),
    title: String(item.title ?? item.name ?? "Notificação"),
    description: String(item.message ?? item.description ?? ""),
    timeLabel: formatDate(created),
    type: validType,
    unread:
      typeof item.read === "boolean"
        ? !item.read
        : typeof item.viewed === "boolean"
        ? !item.viewed
        : typeof item.unread === "boolean"
        ? !!item.unread
        : idx < 2,
  };
}

export default function IgrejaNotificationsScreen() {
  const [tab, setTab] = useState<TabKey>("all");

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () => listar(),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const all = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    return arr.map((it, i) => normalise(it, i));
  }, [data]);

  const filtered = useMemo(() => all.filter((n) => matchesTab(n.type, tab)), [all, tab]);

  const unreadCount = useMemo(() => all.filter((n) => n.unread).length, [all]);
  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, schedules: 0, events: 0, community: 0 };
    for (const n of all) {
      c.all += 1;
      for (const t of ["schedules", "events", "community"] as TabKey[]) {
        if (matchesTab(n.type, t)) c[t] += 1;
      }
    }
    return c;
  }, [all]);

  return (
    <>
      <AppHeader
        title="Notificações"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} ${unreadCount === 1 ? "não lida" : "não lidas"}`
            : "Todas atualizadas"
        }
        showBack
        rightIcons={
          unreadCount > 0
            ? [
                {
                  key: "bell" as const,
                  onPress: () => {},
                },
              ]
            : undefined
        }
      />
      <ScreenContainer
        scrollable={false}
        padded={false}
        edges={["left", "right", "bottom"]}
        noTopPadding
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
      >
        <View style={styles.tabsWrap}>
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = tabCounts[t.key];
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={({ pressed }) => [
                  styles.pill,
                  active && styles.pillActive,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
                ]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
                {count > 0 ? (
                  <View
                    style={[
                      styles.pillBadge,
                      active ? styles.pillBadgeActive : styles.pillBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBadgeText,
                        active ? { color: theme.colors.primary500 } : { color: "#FFFFFF" },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.listArea}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.skeletonItem}>
                <LoadingSkeleton variant="avatar" width={42} height={42} borderRadius={theme.radius.md} />
                <View style={{ flex: 1, marginLeft: theme.spacing.md, gap: theme.spacing.sm }}>
                  <LoadingSkeleton variant="line" width="80%" height={14} />
                  <LoadingSkeleton variant="line" width="65%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : isError ? (
          <View style={styles.listArea}>
            <ErrorState
              title="Não foi possível carregar"
              message="Verifique a conexão e tente novamente."
              onRetry={onRefresh}
            />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.listArea}>
            <EmptyState
              tint="info"
              title={tab === "all" ? "Nenhuma notificação" : "Nada nesta categoria"}
              description={
                tab === "all"
                  ? "Quando houver novidades da igreja, elas aparecerão aqui."
                  : "Selecione outra aba ou volte mais tarde."
              }
              actionLabel={tab !== "all" ? "Ver todas" : undefined}
              onAction={tab !== "all" ? () => setTab("all") : undefined}
            />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <NotificationItem data={item} onPress={() => {}} />}
            contentContainerStyle={styles.listArea}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  tabsWrap: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white08,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillActive: {
    backgroundColor: "rgba(23,107,255,0.14)",
    borderColor: "rgba(23,107,255,0.30)",
  },
  pillText: {
    ...theme.typography.subtleBold,
    color: theme.colors.foregroundMuted,
  },
  pillTextActive: {
    color: theme.colors.primary400,
  },
  pillBadge: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  pillBadgeActive: {
    backgroundColor: "#FFFFFF",
  },
  pillBadgeInactive: {
    backgroundColor: theme.colors.white16,
  },
  pillBadgeText: {
    ...theme.typography.captionBold,
    fontSize: 11,
  },
  listArea: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxxl,
    flexGrow: 1,
  },
  skeletonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    borderWidth: 0.5,
    borderColor: theme.colors.cardOutline,
  },
});
