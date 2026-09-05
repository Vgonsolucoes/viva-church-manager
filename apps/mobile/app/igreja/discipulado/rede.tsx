import React, { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AppCard } from "@/components/AppCard";
import { theme } from "@/theme";
import { listMyDiscipleshipNetwork } from "@/services/api/discipleship";
import type { DiscipleshipNetworkNode } from "@/types";

const NODE_NAME_WIDTH = 104;
const NODE_H_PADDING = 8;
const NODE_TOTAL_WIDTH = NODE_NAME_WIDTH + NODE_H_PADDING * 2;
const SIBLING_GAP = 24;
const CONNECTOR_V = 40;
const CONNECTOR_THICK = 2;

function countLeaves(node: DiscipleshipNetworkNode): number {
  const children = node.disciples ?? [];
  if (children.length === 0) return 1;
  return children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function subtreeWidth(node: DiscipleshipNetworkNode): number {
  const leaves = countLeaves(node);
  if (leaves <= 1) return NODE_TOTAL_WIDTH;
  return leaves * NODE_TOTAL_WIDTH + (leaves - 1) * SIBLING_GAP;
}

function countTotal(node: DiscipleshipNetworkNode): number {
  const children = node.disciples ?? [];
  return 1 + children.reduce((sum, c) => sum + countTotal(c), 0);
}

function horizontalLineOffset(node: DiscipleshipNetworkNode): { left: number; width: number } {
  const children = node.disciples ?? [];
  if (children.length === 0) return { left: 0, width: 0 };
  const firstChild = children[0];
  const lastChild = children[children.length - 1];
  const firstHalf = subtreeWidth(firstChild) / 2;
  const lastSubtree = subtreeWidth(lastChild);
  const lastHalf = lastSubtree / 2;
  let running = 0;
  for (let i = 0; i < children.length - 1; i++) {
    running += subtreeWidth(children[i]) + SIBLING_GAP;
  }
  const totalSpan = running + lastSubtree;
  const left = firstHalf;
  const width = totalSpan - firstHalf - (lastSubtree - lastHalf);
  return { left, width };
}

interface TreeNodeProps {
  node: DiscipleshipNetworkNode;
  isRoot?: boolean;
}

function TreeNode({ node, isRoot = false }: TreeNodeProps) {
  const children = node.disciples ?? [];
  const childrenCount = children.length;
  const myWidth = subtreeWidth(node);
  const hLine = horizontalLineOffset(node);
  const selfRing = isRoot ? theme.colors.primary500 : undefined;
  const selfRingWidth = isRoot ? 3 : 2.5;

  return (
    <View style={[styles.nodeCol, { width: myWidth }]}>
      <View style={styles.avatarWrap}>
        <Avatar
          src={node.photoUrl}
          name={node.name}
          size="lg"
          ringColor={selfRing}
          ringWidth={selfRingWidth}
        />
        <Text style={styles.nodeName} numberOfLines={1}>
          {node.name}
        </Text>
        {node.stage ? (
          <View style={[styles.stageChip, isRoot && styles.stageChipRoot]}>
            <Text style={[styles.stageText, isRoot && styles.stageTextRoot]} numberOfLines={1}>
              {node.stage}
            </Text>
          </View>
        ) : null}
      </View>

      {childrenCount > 0 ? (
        <>
          <View
            style={[
              styles.connectorVertical,
              { height: CONNECTOR_V },
            ]}
          />

          <View style={[styles.hLineContainer, { width: myWidth, height: CONNECTOR_THICK }]}>
            {childrenCount === 1 ? null : (
              <View
                style={[
                  styles.connectorHorizontal,
                  {
                    left: hLine.left,
                    width: hLine.width,
                  },
                ]}
              />
            )}
          </View>

          <View style={{ height: CONNECTOR_V, width: myWidth }}>
            {children.map((child, idx) => {
              const childWidth = subtreeWidth(child);
              let offsetLeft = 0;
              for (let i = 0; i < idx; i++) {
                offsetLeft += subtreeWidth(children[i]) + SIBLING_GAP;
              }
              const centerOfChild = offsetLeft + childWidth / 2;
              return (
                <View
                  key={`v-${child.memberId}`}
                  style={[
                    styles.connectorVertical,
                    {
                      position: "absolute",
                      left: centerOfChild - CONNECTOR_THICK / 2,
                      top: 0,
                      height: CONNECTOR_V,
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.childrenRow}>
            {children.map((child, idx) => (
              <React.Fragment key={child.memberId}>
                {idx > 0 ? <View style={{ width: SIBLING_GAP }} /> : null}
                <TreeNode node={child} />
              </React.Fragment>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function DiscipuladoRedeScreen() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["discipleship-network"],
    queryFn: () => listMyDiscipleshipNetwork(),
    staleTime: 60_000,
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { root, total } = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { root: null as DiscipleshipNetworkNode | null, total: 0 };
    }
    const r = data[0];
    return { root: r, total: countTotal(r) };
  }, [data]);

  return (
    <ScreenContainer
      edges={["top", "left", "right", "bottom"]}
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
      scrollable={false}
      padded={false}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={styles.headerInner}>
        <Text style={styles.screenTitle}>Minha Rede</Text>
        <Text style={styles.screenSubtitle}>Árvore de discipulado</Text>
      </View>

      <View style={{ paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md }}>
        <AppCard padding={theme.spacing.lg}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.totalIcon, { backgroundColor: "rgba(23,107,255,0.14)" }]}>
              <Users size={20} color={theme.colors.primary400} />
            </View>
            <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
              <Text style={styles.totalLabel}>Total da sua rede</Text>
              <Text style={styles.totalValue}>{total} pessoas</Text>
            </View>
          </View>
        </AppCard>
      </View>

      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: theme.spacing.xxxl }}>
          <LoadingSpinner />
        </View>
      ) : !root ? (
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <EmptyState
            tint="cells"
            title="Rede vazia"
            description="Sua rede de discipulado aparecerá assim que você for conectado como discípulo ou discipulador."
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 48, alignItems: "center" }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          horizontal
        >
          <ScrollView
            contentContainerStyle={{ alignItems: "center", justifyContent: "center" }}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            centerContent
          >
            <TreeNode node={root} isRoot />
          </ScrollView>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerInner: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  screenTitle: {
    ...theme.typography.titleLg,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
  },
  screenSubtitle: {
    ...theme.typography.body,
    color: theme.colors.foregroundMuted,
    marginTop: theme.spacing.xs,
  },
  totalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  totalLabel: {
    ...theme.typography.subtle,
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
  },
  totalValue: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
    marginTop: 2,
  },
  nodeCol: {
    alignItems: "center",
  },
  avatarWrap: {
    alignItems: "center",
    width: NODE_TOTAL_WIDTH,
    paddingHorizontal: NODE_H_PADDING,
  },
  nodeName: {
    ...theme.typography.captionBold,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
    marginTop: 6,
    textAlign: "center",
    fontSize: 11,
  },
  stageChip: {
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white16,
  },
  stageChipRoot: {
    backgroundColor: "rgba(23,107,255,0.18)",
  },
  stageText: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 10,
  },
  stageTextRoot: {
    color: theme.colors.primary300,
  },
  connectorVertical: {
    width: CONNECTOR_THICK,
    backgroundColor: theme.colors.primary400,
    alignSelf: "center",
  },
  connectorHorizontal: {
    position: "absolute",
    top: 0,
    height: CONNECTOR_THICK,
    backgroundColor: theme.colors.primary400,
  },
  hLineContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  childrenRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
});
