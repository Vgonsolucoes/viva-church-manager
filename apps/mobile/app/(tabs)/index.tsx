import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, FlatList, Dimensions, Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Clock, MapPin } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { theme, useAppTheme } from "@/constants/theme";
import { useThemedStyles } from "@/theme";
import { friendlyEventDate, weekdayLabel, formatTime } from "@/utils/date";
import { listMySchedules } from "@/services/api/schedules";
import { getMyCell } from "@/services/api/cellsMy";
import { listEvents } from "@/services/api/events";
import type { AgendaCategory, CellDetail, EventPublic } from "@/types";
import { Link, useRouter } from "expo-router";
import { splitUpcomingEvents } from "@/utils/event-feed";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppCard } from "@/components/AppCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { SectionHeader } from "@/components/SectionHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/Badge";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSkeleton, SkeletonCardLines } from "@/components/LoadingSkeleton";
import { EventCard, EventCardData } from "@/components/EventCard";
import { ErrorState } from "@/components/ErrorState";

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
      return { label: "Ensaio", icon: "music-circle", color: "#8B5CF6", bg: theme.colors.borderPrimary };
    case "ESCALA":
      return { label: "Escala", icon: "clipboard-text-clock", color: "#0EA5E9", bg: theme.colors.borderPrimary };
    case "CONFERENCIA":
      return { label: "Conferência", icon: "microphone-variant", color: "#EC4899", bg: theme.colors.borderPrimary };
    default:
      return { label: "Agenda", icon: "calendar", color: theme.colors.primary, bg: theme.colors.primarySoft };
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function eventToCardData(e: EventPublic, idx: number): EventCardData {
  const d = new Date(e.startsAt);
  const monthShort = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
  const dateStartLabel = String(d.getDate()).padStart(2, "0");
  const dateEndLabel = e.endsAt ? String(new Date(e.endsAt).getDate()).padStart(2, "0") : undefined;
  return {
    id: e.id,
    title: e.name,
    dateLabel: friendlyEventDate(e.startsAt),
    dateStartLabel,
    dateEndLabel,
    monthShort,
    location: e.location ?? undefined,
    imageUrl: e.bannerImageUrl ?? undefined,
    category: (e.type ?? "EVENTO") as any,
    registrationOpen: true,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles, theme);

  const { me, initialized, refreshMe } = useAuth();

  const {
    data: schedules,
    isLoading: schedulesLoading,
    isFetching: schedulesFetching,
    refetch: refetchSchedules,
    error: schedulesError,
  } = useQuery({
    queryKey: ["my-schedules-home"],
    queryFn: () => listMySchedules(),
    enabled: initialized && !!me && (!me.access || me.access.mobileModules.includes("schedules")),
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
    enabled: initialized && !!me && (!me.access || me.access.mobileModules.includes("cells")),
    staleTime: 5 * 60_000,
  });

  const {
    data: eventsList,
    isLoading: eventsLoading,
    isFetching: eventsFetching,
    refetch: refetchEvents,
    error: eventsError,
  } = useQuery({
    queryKey: ["events-home"],
    queryFn: () => listEvents(),
    enabled: initialized && !!me,
    staleTime: 5 * 60_000,
  });

  const isLoadingAny = schedulesLoading || cellLoading || eventsLoading;
  const isFetchingAny = schedulesFetching || cellFetching || eventsFetching;

  const firstError =
    (eventsError as Error | null) ||
    (schedulesError as Error | null) ||
    (cellError as Error | null);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refreshMe(true),
      ...(!me?.access || me.access.mobileModules.includes("schedules") ? [refetchSchedules()] : []),
      ...(!me?.access || me.access.mobileModules.includes("cells") ? [refetchCell()] : []),
      refetchEvents(),
    ]);
  }, [refreshMe, refetchSchedules, refetchCell, refetchEvents, me?.access]);

  const feed = useMemo(() => splitUpcomingEvents(eventsList ?? []), [eventsList]);

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

  const upcomingEvents = useMemo(() => {
    return feed.events.map(eventToCardData);
  }, [feed]);

  const isLoading = !initialized || isLoadingAny;

  const headerLeft = (
    <View style={styles.headerLeftInner}>
      <Text style={styles.greetingText}>{greeting()},</Text>
      <Text style={styles.usernameText} numberOfLines={1}>
        {me?.name ?? "Carregando..."}{" "}
        <Text style={{ fontSize: 18 }}>👋</Text>
      </Text>
    </View>
  );

  const headerRight = (
    <Avatar src={me?.image} name={me?.name} size="sm" style={{ width: 44, height: 44, borderRadius: 22 }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.headerBar}>
        <View style={{ flex: 1 }}>{headerLeft}</View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><ThemeToggle />{headerRight}</View>
      </View>

      <ScreenContainer
        scrollable={true}
        padded={true}
        edges={["left", "right", "bottom"]}
        noTopPadding={true}
        refreshing={isFetchingAny && !isLoading}
        onRefresh={onRefresh}
      >
        {firstError && !isLoading ? (
          <View style={{ marginBottom: 16 }}>
            <ErrorState
              title="Erro ao carregar"
              message={firstError.message || "Arraste para atualizar."}
              onRetry={onRefresh}
            />
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ gap: 16 }}>
            <LoadingSkeleton variant="heroCard" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <LoadingSkeleton variant="card" />
              </View>
              <View style={{ flex: 1 }}>
                <LoadingSkeleton variant="card" />
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <LoadingSkeleton variant="title" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <LoadingSkeleton variant="gridCard" style={{ width: SCREEN_WIDTH * 0.72 }} />
                <LoadingSkeleton variant="gridCard" style={{ width: SCREEN_WIDTH * 0.72 }} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <SectionHeader title="Próximos cultos" actionLabel="Ver todos" onActionPress={() => router.push("/igreja/cultos")} />
            {feed.services.length ? <FlatList
              data={feed.services.slice(0, 6)}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 8 }}
              renderItem={({ item }) => <View style={{ width: SCREEN_WIDTH * 0.84 }}><HeroCultoCard culto={item} /></View>}
            /> : <HeroCultoCard />}

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <NextScheduleCard schedule={nextSchedule} />
              </View>
              <View style={{ flex: 1 }}>
                <MyCellCard cell={myCell} />
              </View>
            </View>

            <SectionHeader
              title="Eventos"
              actionLabel="Ver todos"
              onActionPress={() => router.push("/igreja/eventos")}
            />

            {upcomingEvents.length === 0 ? (
              <AppCard variant="default">
                <EmptyState
                  title="Nenhum evento próximo"
                  description="Em breve novos eventos aparecerão aqui."
                  tint="agenda"
                />
              </AppCard>
            ) : (
              <FlatList
                data={upcomingEvents}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 8 }}
                renderItem={({ item }) => (
                  <View style={{ width: SCREEN_WIDTH * 0.76 }}>
                    <EventCard data={item} compact onView={() => router.push(`/igreja/eventos/${item.id}`)} onParticipate={() => router.push(`/igreja/eventos/${item.id}`)} />
                  </View>
                )}
              />
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScreenContainer>
    </View>
  );
}

function HeroCultoCard({ culto }: { culto?: EventPublic }) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles, theme);

  if (!culto) {
    return (
      <AppCard variant="hero" style={{ backgroundColor: theme.colors.cardDark }}>
        <View style={styles.heroInner}>
          <View style={styles.heroTopRow}>
            <Badge label="PRÓXIMO CULTO" variant="primary" />
          </View>
          <View style={{ marginTop: 12 }}>
            <EmptyState
              title="Nenhum culto agendado"
              description="Em breve o próximo culto aparecerá aqui."
              tint="info"
            />
          </View>
        </View>
      </AppCard>
    );
  }

  const d = new Date(culto.startsAt);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const timeStr = formatTime(culto.startsAt);

  return (
    <AppCard variant="hero" padding={0} style={{ overflow: "hidden" }}>
      {culto.bannerImageUrl && <Image source={{ uri: culto.bannerImageUrl }} accessibilityLabel={`Arte de ${culto.name}`} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: theme.colors.card }} resizeMode="contain" />}
      <LinearGradient
        colors={[theme.colors.gradientFrom, theme.colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: theme.spacing.xl }}
      >
        <View style={styles.heroInner}>
          <View style={styles.heroTopRow}>
            <Badge label="PRÓXIMO CULTO" variant="primary" />
          </View>

          <Text numberOfLines={2} style={styles.heroTitle}>
            {culto.name}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaText}>
                {isToday ? "Hoje" : friendlyEventDate(culto.startsAt)}
              </Text>
            </View>
            <View style={[styles.heroMetaDot, { backgroundColor: "rgba(255,255,255,0.30)" }]} />
            <View style={styles.heroMetaItem}>
              <Clock size={16} color={theme.colors.onPrimary} />
              <Text style={[styles.heroMetaText, { marginLeft: 6 }]}>{timeStr}</Text>
            </View>
          </View>

          {culto.location ? (
            <View style={[styles.heroMetaRow, { marginTop: 8 }]}>
              <MapPin size={16} color={theme.colors.onPrimary} />
              <Text style={[styles.heroMetaText, { marginLeft: 6, color: theme.colors.onPrimary }]} numberOfLines={1}>
                {culto.location}
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <SecondaryButton
              title="Ver detalhes"
              onPress={() => router.push(`/igreja/cultos/${culto.id}`)}
              style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.borderSubtle }}
              variant="outline"
              height={44}
            />
          </View>
        </View>
      </LinearGradient>
    </AppCard>
  );
}

function NextScheduleCard({ schedule }: { schedule: any }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles, theme);

  const hasSched = !!schedule?.schedule;
  const st = schedule?.status ?? "PENDING";
  const dateLabel = hasSched ? friendlyEventDate(schedule.schedule.startsAt) : undefined;
  const timeLabel = hasSched ? formatTime(schedule.schedule.startsAt) : undefined;

  return (
    <AppCard variant="default">
      <View style={{ gap: 8 }}>
        <View style={styles.miniCardHeader}>
          <Badge label="Escala" variant="cyan" />
        </View>
        {!hasSched ? (
          <View style={{ paddingVertical: 8 }}>
            <Text style={styles.miniCardEmpty}>Sem escalas</Text>
          </View>
        ) : (
          <>
            <Text numberOfLines={2} style={styles.miniCardTitle}>
              {schedule.roleName}
            </Text>
            <Text numberOfLines={2} style={styles.miniCardSubtitle}>
              {schedule.schedule.title}
            </Text>
            <View style={{ marginTop: 4 }}>
              <StatusBadge status={st} />
            </View>
            {dateLabel ? (
              <Text style={styles.miniCardMeta}>
                {dateLabel} {timeLabel ? `• ${timeLabel}` : ""}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </AppCard>
  );
}

function MyCellCard({ cell }: { cell: CellDetail | null | undefined }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles, theme);

  return (
    <AppCard variant="default">
      <View style={{ gap: 8 }}>
        <View style={styles.miniCardHeader}>
          <Badge label="Célula" variant="success" />
        </View>
        {!cell ? (
          <View style={{ paddingVertical: 8 }}>
            <Text style={styles.miniCardEmpty}>Sem célula</Text>
          </View>
        ) : (
          <>
            <Text numberOfLines={2} style={styles.miniCardTitle}>
              {cell.name}
            </Text>
            <Text style={styles.miniCardSubtitle}>
              {weekdayLabel(cell.weekday)} • {cell.time}
            </Text>
            <Text style={styles.miniCardMeta}>
              {cell.membersCount} membros
            </Text>
          </>
        )}
      </View>
    </AppCard>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => (StyleSheet.create({
  headerBar: {
    paddingTop: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.background,
  },
  headerLeftInner: { flex: 1, justifyContent: "center" },
  greetingText: {
    color: theme.colors.foregroundMuted,
    fontSize: 13,
    fontFamily: theme.fontFamilies.medium,
  },
  usernameText: {
    color: theme.colors.foreground,
    fontSize: 20,
    fontFamily: theme.fontFamilies.bold,
    marginTop: 2,
  },
  heroInner: { width: "100%" },
  heroTopRow: { flexDirection: "row", alignItems: "center" },
  heroTitle: {
    marginTop: 14,
    color: theme.colors.onPrimary,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  heroMetaItem: { flexDirection: "row", alignItems: "center" },
  heroMetaDot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 10 },
  heroMetaText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 14,
  },
  miniCardHeader: { flexDirection: "row", alignItems: "center" },
  miniCardTitle: {
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  miniCardSubtitle: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  miniCardMeta: {
    color: theme.colors.primary400,
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 12,
    marginTop: 2,
  },
  miniCardEmpty: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.medium,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 16,
  },
}));

void weekdayLabel;
void formatTime;
void Screen;
void Card;
void LoadingSpinner;
void MaterialCommunityIcons;
void categoryMeta;
