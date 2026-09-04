import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { listPublicCells } from "@/services/api/cells";
import { weekdayLabel } from "@/utils/date";
import { hasPermission } from "@/permissions";
import { useAuth } from "@/hooks/useAuth";

export default function CelulasScreen() {
  const { me } = useAuth();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["public-cells"],
    queryFn: () => listPublicCells(),
    staleTime: 60_000,
  });
  const perms = me?.permissions ?? [];
  const roles = (me?.roles ?? []) as string[];
  const canWrite = hasPermission(perms, "cells:write") || roles.includes("SUPER_ADMIN");

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const cells = data ?? [];

  return (
    <Screen
      backgroundBrand
      title="Células"
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
      loading={isLoading}
    >
      {cells.length === 0 && !isLoading ? (
        <EmptyState
        icon="people-outline"
        title="Sem células cadastradas"
        description="Quando as células forem publicadas aparecerão aqui."
        actionLabel="Atualizar"
        onAction={onRefresh}
      />
      ) : null}
      {cells.length === 0 && isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <LoadingSpinner />
        </View>
      ) : null}
      <View style={{ gap: 12 }}>
        {cells.map((c) => (
          <Card key={c.id} elevated>
            <View style={styles.row}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayShort}>{weekdayLabel(c.weekday).slice(0, 3).toUpperCase()}</Text>
                <Text style={styles.dayFull}>{c.time}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{c.name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.metaText}>Líder: {c.leaderName}</Text>
                </View>
                {c.address ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
                    <Text style={[styles.metaText, { color: theme.colors.muted }]} numberOfLines={2}>
                      {c.address}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  dayBadge: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
  },
  dayShort: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  dayFull: {
    marginTop: 4,
    color: theme.colors.foregroundDark,
    fontSize: 12,
    fontWeight: "700",
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  metaText: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: "600",
    },
});
