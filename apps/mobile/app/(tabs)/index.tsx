import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { theme } from "@/constants/theme";
import { friendlyEventDate } from "@/utils/date";
import { listPublicEvents } from "@/services/api/events";
import { hasPermission } from "@/permissions";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 19) return "Boa tarde";
  return "Boa noite";
}

export default function HomeScreen() {
  const { me, initialized, loading: authLoading, refreshMe } = useAuth();
  const {
    data: events,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["public-events"],
    queryFn: () => listPublicEvents(),
    enabled: initialized,
    staleTime: 60_000,
  });

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (events ?? [])
      .filter((e) => {
        const startMs = new Date(e.startsAt).getTime();
        if (Number.isNaN(startMs)) return false;
        const endMs = e.endsAt && !Number.isNaN(new Date(e.endsAt).getTime())
          ? new Date(e.endsAt).getTime()
          : startMs + 3_600_000;
        return endMs + 1_800_000 >= now;
      })
      .slice()
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
      .slice(0, 3);
  }, [events]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshMe(true), refetch()]);
  }, [refreshMe, refetch]);

  const userRoles = (me?.roles ?? []) as string[];
  const userPermissions = me?.permissions ?? [];
  const canSeeSchedules = hasPermission(userPermissions, "schedules:read") || userRoles.includes("SUPER_ADMIN");

  return (
    <Screen
      backgroundBrand
      padded={false}
      loading={!initialized}
      loadingLabel="Carregando..."
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar src={me?.image} name={me?.name} size={48} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.username} numberOfLines={1}>
              {me?.name ?? "Carregando..."}
            </Text>
          </View>
        </View>
        <Link href="/perfil/biometria" asChild>
          <Pressable style={styles.iconButton} android_ripple={{ color: "rgba(255,255,255,0.18)", borderless: true }}>
            <Ionicons name="finger-print-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </Link>
      </View>

      <View style={styles.summary}>
        <SummaryCard
          label="Próximos eventos"
          value={upcoming.length > 0 ? upcoming.length.toString() : "-"}
          icon="calendar"
        />
        <SummaryCard
          label="Escalas pendentes"
          value={canSeeSchedules ? "Em breve" : "Bloqueado"}
          icon="clipboard"
          muted={!canSeeSchedules}
        />
        <SummaryCard
          label="Células ativas"
          value={me?.leadingCellIds?.length ? me.leadingCellIds.length.toString() : "-"}
          icon="people"
        />
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Acesso rápido</Text>
        <View style={styles.actionsGrid}>
          <QuickAction icon="calendar" label="Agenda" href="/(tabs)/agenda" />
          <QuickAction
            icon="clipboard"
            label="Escalas"
            href="/(tabs)/escalas"
            disabled={!canSeeSchedules}
          />
          <QuickAction icon="people" label="Células" href="/(tabs)/celulas" />
          <QuickAction
            icon="person-circle"
            label="Perfil"
            href="/(tabs)/perfil"
          />
        </View>
      </View>

      <View style={styles.eventsSection}>
        <View style={styles.eventsHeader}>
          <Text style={styles.sectionTitle}>Próximos eventos</Text>
          <Link href="/(tabs)/agenda">
            <Text style={styles.seeAll}>Ver todos</Text>
          </Link>
        </View>

        <FlatList
          horizontal
          data={upcoming}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ gap: 12, paddingRight: 16 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card style={styles.eventCard} padding="none" elevated>
              <View style={styles.eventImageWrap}>
                {item.bannerImageUrl ? (
                  <Image
                    source={{ uri: item.bannerImageUrl }}
                    style={styles.eventImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.eventImagePlaceholder}>
                    <Ionicons name="calendar" size={40} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <View style={styles.eventBody}>
                <Text style={styles.eventName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.eventMetaRow}>
                  <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.eventDate}>{friendlyEventDate(item.startsAt)}</Text>
                </View>
                {item.location ? (
                  <View style={styles.eventMetaRow}>
                    <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
                    <Text style={styles.eventLocation} numberOfLines={1}>
                      {item.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={{ alignItems: "center", width: 260, paddingVertical: 30 }}>
              <LoadingSpinner size="small" />
            </View>
            ) : (
              <View style={{ width: 280 }}>
                <EmptyState
                  icon="calendar-clear-outline"
                  title="Sem eventos próximos"
                  description="Novos cultos e encontros aparecerão aqui assim que forem agendados."
                />
              </View>
            )
          }
        />
      </View>

      <View style={{ height: 40 }} />
    </Screen>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  muted,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  muted?: boolean;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, muted && { opacity: 0.5 }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <Text style={[styles.summaryValue, muted && { opacity: 0.6 }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  href,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: any;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <View style={[styles.quickAction, styles.quickActionDisabled]}>
        <View style={styles.quickIcon}>
          <Ionicons name={icon} size={22} color={theme.colors.muted} />
        </View>
        <Text style={styles.quickLabelDisabled}>{label}</Text>
      </View>
    );
  }
  return (
    <Link href={href} asChild>
      <Pressable style={styles.quickAction} android_ripple={{ color: theme.colors.primarySoft, borderless: true }}>
        <View style={[styles.quickIcon]}>
          <Ionicons name={icon} size={22} color={theme.colors.primary} />
        </View>
        <Text style={styles.quickLabel}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  greeting: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "500" },
  username: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 2 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  summary: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  quickActions: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  quickAction: {
    width: "23%",
    alignItems: "center",
    gap: 6,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickActionDisabled: {
    opacity: 0.55,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    color: theme.colors.foregroundDark,
    fontSize: 11,
    fontWeight: "600",
  },
  quickLabelDisabled: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  eventsSection: {
    marginTop: 24,
  },
  eventsHeader: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seeAll: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  eventCard: {
    width: 260,
    marginRight: 0,
    overflow: "hidden",
  },
  eventImageWrap: {
      width: "100%",
      height: 130,
      backgroundColor: theme.colors.primary,
    },
  eventImage: { width: "100%", height: "100%" },
  eventImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  eventBody: { padding: 12 },
  eventName: {
    color: theme.colors.foregroundDark,
    fontSize: 15,
    fontWeight: "700",
  },
  eventMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
    },
  eventDate: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "600",
    },
  eventLocation: {
      color: theme.colors.muted,
      fontSize: 12,
      flex: 1,
    },
});
