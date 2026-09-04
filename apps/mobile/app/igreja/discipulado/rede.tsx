import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { listMyDiscipleshipNetwork } from "@/services/api/discipleship";
import type { DiscipleshipNetworkNode } from "@/types";

type FlattenedNode = {
  key: string;
  node: DiscipleshipNetworkNode;
  depth: number;
  hasChildren: boolean;
  parentKey?: string;
};

function flattenTree(
  node: DiscipleshipNetworkNode,
  depth: number,
  collapsed: Set<string>,
  parentKey?: string,
  out: FlattenedNode[] = [],
): FlattenedNode[] {
  const key = node.memberId;
  const hasChildren = Array.isArray(node.disciples) && node.disciples.length > 0;
  out.push({ key, node, depth, hasChildren, parentKey });
  if (hasChildren && !collapsed.has(key)) {
    for (const child of node.disciples) {
      flattenTree(child, depth + 1, collapsed, key, out);
    }
  }
  return out;
}

export default function DiscipuladoRedeScreen() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["discipleship-network"],
    queryFn: () => listMyDiscipleshipNetwork(),
    staleTime: 60_000,
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const flat = useMemo<FlattenedNode[]>(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    const result: FlattenedNode[] = [];
    for (const root of data) {
      flattenTree(root, 0, collapsed, undefined, result);
    }
    return result;
  }, [data, collapsed]);

  return (
    <Screen
      backgroundBrand
      title="Rede de discipulado"
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
      loading={isLoading}
    >
      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <LoadingSpinner />
        </View>
      ) : !data ? (
        <EmptyState
          icon="git-network-outline"
          title="Sem rede carregada"
          description="A rede de discipulado será exibida assim que você for conectado como discípulo ou discipulador."
          actionLabel="Atualizar"
          onAction={onRefresh}
        />
      ) : (
        <FlatList
          data={flat}
          keyExtractor={(f) => f.key}
          contentContainerStyle={{ paddingBottom: 40, gap: 6 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <NetworkRow item={item} collapsed={collapsed.has(item.key)} onToggle={toggle} />
          )}
        />
      )}
    </Screen>
  );
}

function NetworkRow({
  item,
  collapsed,
  onToggle,
}: {
  item: FlattenedNode;
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  const depth = Math.min(item.depth, 4);
  const stageColorByDepth = [
    theme.colors.primary,
    theme.colors.success,
    theme.colors.warning,
    theme.colors.accent,
    theme.colors.secondary,
  ];
  const color = stageColorByDepth[depth] ?? theme.colors.muted;
  return (
    <Pressable
      style={[styles.row, { marginLeft: depth * 18 }]}
      onPress={() => item.hasChildren && onToggle(item.key)}
      android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
      disabled={!item.hasChildren}
    >
      <View style={[styles.leaderLine, { backgroundColor: color }]} />
      <Avatar
        src={item.node.photoUrl}
        name={item.node.name}
        size={40}
      />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.node.name}
        </Text>
        {item.node.stage ? (
          <View style={[styles.stageChip, { backgroundColor: `${color}22` }]}>
            <Text style={[styles.stageText, { color }]}>{item.node.stage}</Text>
          </View>
        ) : null}
      </View>
      {item.hasChildren ? (
        <View style={[styles.chevronBtn, { backgroundColor: `${color}18` }]}>
          <Ionicons
            name={collapsed ? "chevron-forward" : "chevron-down"}
            size={16}
            color={color}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  leaderLine: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  stageChip: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  stageText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  chevronBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
