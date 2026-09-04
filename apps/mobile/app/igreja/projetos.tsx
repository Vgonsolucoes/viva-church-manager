import React, { useCallback } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { listProjects } from "@/services/api/projects";
import { formatCurrencyBRL, formatDate } from "@/utils/date";

function percent(raised: number, goal: number): number {
  if (!goal || goal <= 0) return 0;
  const raw = (raised / goal) * 100;
  return Math.max(0, Math.min(100, raw));
}

export default function IgrejaProjetosScreen() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["fundraising-projects"],
    queryFn: () => listProjects(),
    staleTime: 60_000,
  });
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const items = data ?? [];
  const sorted = [...items].sort((a, b) => {
    const pa = percent(a.raisedCents, a.goalCents);
    const pb = percent(b.raisedCents, b.goalCents);
    return pb - pa;
  });
  return (
    <Screen
      backgroundBrand
      title="Projetos e ofertas"
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
      loading={isLoading}
    >
      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <LoadingSpinner />
        </View>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Nenhum projeto ativo"
          description="Quando houver campanhas ou projetos de arrecadação, eles aparecerão aqui com o progresso da meta."
          actionLabel="Atualizar"
          onAction={onRefresh}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {sorted.map((p) => {
            const pct = percent(p.raisedCents, p.goalCents);
            return (
              <Card key={p.id} elevated padding="none" style={{ overflow: "hidden" }}>
                <View style={styles.bannerWrap}>
                  {p.bannerImageUrl ? (
                    <Image
                      source={{ uri: p.bannerImageUrl }}
                      style={styles.bannerImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.bannerFallback}>
                      <Ionicons name="heart" size={36} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={{ padding: 14 }}>
                  <Text style={styles.title} numberOfLines={2}>
                    {p.title}
                  </Text>
                  {p.description ? (
                    <Text style={styles.desc} numberOfLines={3}>
                      {p.description}
                    </Text>
                  ) : null}
                  <View style={styles.progressRow}>
                    <Text style={styles.pctLabel}>{pct.toFixed(0)}%</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  </View>
                  <View style={styles.statsRow}>
                    <Stat label="Arrecadado" value={formatCurrencyBRL(p.raisedCents)} accent />
                    <Stat label="Meta" value={formatCurrencyBRL(p.goalCents)} />
                  </View>
                  {(p.startDate || p.endDate) ? (
                    <View style={styles.datesRow}>
                      {p.startDate ? (
                        <DateMini label="Início" value={formatDate(p.startDate)} />
                      ) : null}
                      {p.endDate ? (
                        <DateMini label="Término" value={formatDate(p.endDate)} />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: theme.colors.success }]}>{value}</Text>
    </View>
  );
}

function DateMini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dateMini}>
      <Ionicons name="calendar-outline" size={13} color={theme.colors.muted} />
      <Text style={styles.dateMiniLabel}>{label}:</Text>
      <Text style={styles.dateMiniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    width: "100%",
    height: 140,
    backgroundColor: theme.colors.primary,
  },
  bannerImg: { width: "100%", height: "100%" },
  bannerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  desc: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  pctLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.primary,
    minWidth: 52,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(107,115,128,0.18)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  statValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  datesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  dateMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateMiniLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  dateMiniValue: {
    fontSize: 11,
    color: theme.colors.foregroundDark,
    fontWeight: "700",
  },
});
