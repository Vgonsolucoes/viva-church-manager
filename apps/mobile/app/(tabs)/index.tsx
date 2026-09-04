import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { theme } from "@/constants/theme";
import { friendlyEventDate, weekdayLabel, formatTime } from "@/utils/date";
import { listMyAgenda } from "@/services/api/agenda";
import { listMySchedules } from "@/services/api/schedules";
import { getMyCell } from "@/services/api/cellsMy";
import type { AgendaCategory, CellDetail } from "@/types";
import { Link } from "expo-router";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 19) return "Boa tarde";
  return "Boa noite";
}

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function categoryMeta(cat: AgendaCategory): { label: string; icon: IconName; color: string; bg: string } {
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

export default function HomeScreen() {
  const { me, initialized, refreshMe } = useAuth();

  const {
    data: agenda,
    isLoading: agendaLoading,
    isFetching: agendaFetching,
    refetch: refetchAgenda,
    error: agendaError,
  } = useQuery({
    queryKey: ["my-agenda-home"],
    queryFn: () => listMyAgenda(),
    enabled: initialized && !!me,
    staleTime: 60_000,
  });

  const {
    data: schedules,
    isLoading: schedulesLoading,
    isFetching: schedulesFetching,
    refetch: refetchSchedules,
    error: schedulesError,
  } = useQuery({
    queryKey: ["my-schedules-home"],
    queryFn: () => listMySchedules(),
    enabled: initialized && !!me,
    staleTime: 60_000,
  });

  const {
    data: myCell,
    isLoading: cellLoading,
    isFetching: cellFetching,
    refetch: refetchCell,
    error: cellError,
  } = useQuery<CellDetail | null>({
    queryKey: ["my-cell-home"],
    queryFn: () => getMyCell(),
    enabled: initialized && !!me,
    staleTime: 5 * 60_000,
  });

  const isLoadingAny = agendaLoading || schedulesLoading || cellLoading;
  const isFetchingAny = agendaFetching || schedulesFetching || cellFetching;

  const firstError =
    (agendaError as Error | null) ||
    (schedulesError as Error | null) ||
    (cellError as Error | null);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refreshMe(true),
      refetchAgenda(),
      refetchSchedules(),
      refetchCell(),
    ]);
  }, [refreshMe, refetchAgenda, refetchSchedules, refetchCell]);

  const nextCulto = useMemo(() => {
    const now = Date.now();
    return (agenda ?? [])
      .filter((a) => a.category === "CULTO" && new Date(a.startsAt).getTime() + 3_600_000 >= now)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  }, [agenda]);

  const nextEvent = useMemo(() => {
    const now = Date.now();
    return (agenda ?? [])
      .filter((a) => a.category !== "CULTO" && new Date(a.startsAt).getTime() + 3_600_000 >= now)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  }, [agenda]);

  const nextSchedule = useMemo(() => {
    const now = Date.now();
    return (schedules ?? [])
      .filter((s) => {
        const start = s.schedule?.startsAt ? new Date(s.schedule.startsAt).getTime() : 0;
        return start + 3_600_000 >= now;
      })
      .sort((a, b) => {
        const as = a.schedule?.startsAt ? +new Date(a.schedule.startsAt) : 0;
        const bs = b.schedule?.startsAt ? +new Date(b.schedule.startsAt) : 0;
        return as - bs;
      })[0];
  }, [schedules]);

  const loading = !initialized || isLoadingAny;

  return (
    <Screen
      backgroundBrand
      padded={false}
      loading={loading}
      loadingLabel="Carregando..."
      refreshing={isFetchingAny && !loading}
      onRefresh={onRefresh}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar src={me?.image} name={me?.name} size={48} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.username} numberOfLines={1}>
              Olá, {me?.name ?? "Carregando..."}
            </Text>
          </View>
        </View>
      </View>

      {firstError && !loading ? (
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons name="alert-circle" size={18} color={theme.colors.destructive} />
          <Text style={styles.errorText}>
            {firstError.message || "Erro ao carregar dados. Arraste para atualizar."}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardsList}>
        <HomeCard
          title="Próximo Culto"
          icon="church"
          iconColor={theme.colors.primary}
          iconBg={theme.colors.primarySoft}
          loading={loading}
          emptyText="Nenhum culto agendado"
          emptyIcon="church-outline"
        >
          {nextCulto ? (
            <CardContent
              title={nextCulto.title}
              subtitle={friendlyEventDate(nextCulto.startsAt)}
              location={nextCulto.location ?? undefined}
            />
          ) : null}
        </HomeCard>

        <HomeCard
          title="Próxima Escala"
          icon="clipboard-text-clock"
          iconColor="#0EA5E9"
          iconBg="rgba(14,165,233,0.15)"
          loading={loading}
          emptyText="Sem escalas pendentes"
          emptyIcon="clipboard-outline"
        >
          {nextSchedule?.schedule ? (
            <CardContent
              title={`${nextSchedule.roleName} · ${nextSchedule.schedule.title}`}
              subtitle={friendlyEventDate(nextSchedule.schedule.startsAt)}
              location={nextSchedule.schedule.location ?? undefined}
              badge={nextSchedule.status}
              badgeColor={
                nextSchedule.status === "CONFIRMED"
                  ? theme.colors.success
                  : nextSchedule.status === "DECLINED"
                    ? theme.colors.destructive
                    : theme.colors.warning
              }
            />
          ) : null}
        </HomeCard>

        <HomeCard
          title="Minha Célula"
          icon="account-group"
          iconColor={theme.colors.success}
          iconBg="rgba(23,201,100,0.15)"
          loading={loading}
          emptyText="Você ainda não participa de uma célula"
          emptyIcon="account-group-outline"
        >
          {myCell ? (
            <CardContent
              title={myCell.name}
              subtitle={`${weekdayLabel(myCell.weekday)} · ${myCell.time}`}
              location={myCell.address || undefined}
              badge={myCell.membersCount + " membros"}
              badgeColor={theme.colors.success}
            />
          ) : null}
        </HomeCard>

        <HomeCard
          title="Próximo Evento"
          icon="calendar-star"
          iconColor={theme.colors.accent}
          iconBg={theme.colors.accentSoft}
          loading={loading}
          emptyText="Nenhum evento programado"
          emptyIcon="calendar-blank-outline"
        >
          {nextEvent ? (
            <CardContent
              title={nextEvent.title}
              subtitle={friendlyEventDate(nextEvent.startsAt)}
              location={nextEvent.location || undefined}
              categoryBadge={nextEvent.category}
            />
          ) : null}
        </HomeCard>

        <HomeCard
          title="Avisos / Notificações"
          icon="bell-badge"
          iconColor={theme.colors.warning}
          iconBg="rgba(244,161,0,0.15)"
          loading={loading}
          emptyText="Sem avisos no momento"
          emptyIcon="bell-outline"
          actionLink="/(tabs)/agenda"
          actionLabel="Ver agenda"
        >
          {(agenda ?? []).length > 0 ? (
            <View style={styles.noticePreview}>
              {(agenda ?? [])
                .filter((a) => {
                  const now = Date.now();
                  return new Date(a.startsAt).getTime() + 3_600_000 >= now;
                })
                .slice(0, 2)
                .map((a) => {
                  const meta = categoryMeta(a.category);
                  return (
                    <View key={a.id} style={styles.noticeRow}>
                      <View
                        style={[
                          styles.noticeDot,
                          { backgroundColor: meta.color },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.noticeTitle} numberOfLines={1}>
                          {a.title}
                        </Text>
                        <Text style={styles.noticeSub}>
                          {friendlyEventDate(a.startsAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          ) : null}
        </HomeCard>
      </View>

      <View style={{ height: 24 }} />
    </Screen>
  );
}

function HomeCard({
  title,
  icon,
  iconColor,
  iconBg,
  loading,
  emptyText,
  emptyIcon,
  children,
  actionLink,
  actionLabel,
}: {
  title: string;
  icon: IconName;
  iconColor: string;
  iconBg: string;
  loading?: boolean;
  emptyText?: string;
  emptyIcon?: IconName;
  children?: React.ReactNode;
  actionLink?: string;
  actionLabel?: string;
}) {
  const hasContent = React.Children.count(children) > 0 || loading;
  return (
    <Card elevated padding="lg" style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {actionLink && actionLabel ? (
          <Link href={actionLink as any} asChild>
            <Pressable>
              <Text style={styles.cardAction}>{actionLabel}</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
      <View style={{ marginTop: 10 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <LoadingSpinner size="small" />
          </View>
        ) : hasContent ? (
          children
        ) : (
          <EmptyState
            icon={(emptyIcon as any) ?? "cube-outline"}
            title={emptyText ?? "Nenhum item"}
          />
        )}
      </View>
    </Card>
  );
}

function CardContent({
  title,
  subtitle,
  location,
  badge,
  badgeColor,
  categoryBadge,
}: {
  title: string;
  subtitle: string;
  location?: string;
  badge?: string;
  badgeColor?: string;
  categoryBadge?: AgendaCategory;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={styles.contentTitle} numberOfLines={2}>
          {title}
        </Text>
        {badge ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: (badgeColor ?? theme.colors.muted) + "22" },
            ]}
          >
            <Text style={[styles.badgeText, { color: badgeColor ?? theme.colors.muted }]}>
              {badge}
            </Text>
          </View>
        ) : null}
        {categoryBadge && !badge ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: categoryMeta(categoryBadge).bg },
            ]}
          >
            <Text style={[styles.badgeText, { color: categoryMeta(categoryBadge).color }]}>
              {categoryMeta(categoryBadge).label}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.metaRow}>
        <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.primary} />
        <Text style={styles.contentDate}>{subtitle}</Text>
      </View>
      {location ? (
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.colors.muted} />
          <Text style={styles.contentLocation} numberOfLines={1}>
            {location}
          </Text>
        </View>
      ) : null}
    </View>
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
  cardsList: {
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  card: {
    width: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: theme.font.md,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  cardAction: {
    fontSize: theme.font.sm,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  contentTitle: {
    flex: 1,
    fontSize: theme.font.md,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  contentDate: {
    fontSize: theme.font.sm,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  contentLocation: {
    flex: 1,
    fontSize: theme.font.xs,
    color: theme.colors.muted,
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
  noticePreview: {
    gap: 10,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  noticeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noticeTitle: {
    fontSize: theme.font.sm,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  noticeSub: {
    marginTop: 2,
    fontSize: theme.font.xs,
    color: theme.colors.muted,
  },
});

void weekdayLabel;
void formatTime;
