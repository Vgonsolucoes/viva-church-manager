import React, { useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { listEvents } from "@/services/api/events";
import { friendlyEventDate, formatCurrencyBRL } from "@/utils/date";

export default function IgrejaEventosScreen() {
  const router = useRouter();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["igreja-events"],
    queryFn: () => listEvents(),
    staleTime: 60_000,
  });

  const items = data ?? [];
  const sorted = [...items].sort(
    (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
  );

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <Screen
      backgroundBrand
      title="Eventos"
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
      loading={isLoading}
    >
      <View style={styles.list}>
        {sorted.length === 0 && !isLoading ? (
          <EmptyState
            icon="calendar-number-outline"
            title="Nenhum evento publicado"
            description="Quando a igreja publicar novos cultos ou encontros, eles aparecerão aqui."
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        ) : null}
        {sorted.map((ev) => (
          <Pressable
            key={ev.id}
            onPress={() => router.push(`/igreja/eventos/${ev.id}`)}
            android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
          >
            <Card style={styles.row} padding="none" elevated>
              <View style={styles.rowContent}>
                <View style={styles.eventImageWrap}>
                  {ev.bannerImageUrl ? (
                    <Image
                      source={{ uri: ev.bannerImageUrl }}
                      style={styles.eventImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.eventImagePlaceholder}>
                      <Ionicons name="calendar" size={32} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, padding: 12 }}>
                  <Text style={styles.eventName} numberOfLines={2}>
                    {ev.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
                    <Text style={styles.eventDate}>{friendlyEventDate(ev.startsAt)}</Text>
                  </View>
                  {ev.location ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {ev.location}
                      </Text>
                    </View>
                  ) : null}
                  {ev.isPaid && ev.ticketPriceCents != null ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="ticket-outline" size={14} color={theme.colors.accent} />
                      <Text style={[styles.metaText, { color: theme.colors.accent, fontWeight: "700" }]}>
                        {formatCurrencyBRL(ev.ticketPriceCents)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.chevronWrap}>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
                </View>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, flex: 1 },
  row: { overflow: "hidden" },
  rowContent: { flexDirection: "row", alignItems: "center" },
  eventImageWrap: { width: 100, height: 110, backgroundColor: theme.colors.secondary },
  eventImage: { width: "100%", height: "100%" },
  eventImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  eventName: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  eventDate: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  metaText: { fontSize: 12, color: theme.colors.muted, flex: 1 },
  chevronWrap: {
    paddingHorizontal: 12,
  },
});
