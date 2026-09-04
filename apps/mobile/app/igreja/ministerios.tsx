import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { listMyMinistries } from "@/services/api/ministries";

export default function IgrejaMinisteriosScreen() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["my-ministries"],
    queryFn: () => listMyMinistries(),
    staleTime: 60_000,
  });
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const items = data ?? [];
  return (
    <Screen
      backgroundBrand
      title="Meus ministérios"
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
      loading={isLoading}
    >
      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <LoadingSpinner />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title="Sem ministérios ativos"
          description="Quando você for vinculado a um ministério, ele aparecerá aqui com sua função e líder."
          actionLabel="Atualizar"
          onAction={onRefresh}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((m: { id: string; name: string; leaderName?: string | null; description?: string | null }) => (
            <Card key={m.id} elevated padding="lg">
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name="briefcase" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{m.name}</Text>
                  {m.leaderName ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="person-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.metaText}>Líder: {m.leaderName}</Text>
                    </View>
                  ) : null}
                  {m.description ? (
                    <Text style={styles.desc} numberOfLines={3}>
                      {m.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  desc: {
    marginTop: 8,
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
  },
});
