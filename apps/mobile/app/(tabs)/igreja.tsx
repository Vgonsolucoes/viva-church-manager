import React, { useCallback, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { MinistryCard, MinistryKey } from "@/components/MinistryCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useSessionStore } from "@/stores/session";
import { hasAnyPermission, hasPermission } from "@/permissions";
import { useAuth } from "@/hooks/useAuth";
import type { PermissionKey } from "@/types";
import { theme } from "@/theme";

interface MenuItemDef {
  key: MinistryKey;
  href: string;
  anyPermission?: PermissionKey[];
  requirePermission?: PermissionKey;
}

const MENU: MenuItemDef[] = [
  {
    key: "events",
    href: "/igreja/eventos",
    anyPermission: ["events:read", "calendar:read"],
  },
  {
    key: "cells",
    href: "/igreja/celulas",
    anyPermission: ["cells:read"],
  },
  {
    key: "discipleships",
    href: "/igreja/discipulado",
    anyPermission: ["discipleships:read", "discipleship:my:read"],
  },
  {
    key: "ministries",
    href: "/igreja/ministerios",
    anyPermission: ["ministries:read"],
  },
  {
    key: "projects",
    href: "/igreja/projetos",
    anyPermission: ["assets:read"],
  },
  {
    key: "prayer",
    href: "/igreja/oracao",
    anyPermission: ["prayer:read", "prayer:write"],
  },
  {
    key: "qr",
    href: "/qr/scan",
    anyPermission: ["events:read", "members:read", "schedules:confirm", "kids:checkin:self"],
  },
  {
    key: "kids",
    href: "/igreja/infantil",
    anyPermission: ["kids:read", "kids:checkin:self"],
  },
  {
    key: "notifications",
    href: "/igreja/notifications",
    anyPermission: ["notifications:read"],
  },
];

export default function IgrejaScreen() {
  const router = useRouter();
  const { initialized, refreshMe } = useAuth();
  const { me } = useSessionStore();
  const permissions = me?.permissions ?? [];
  const roles = (me?.roles ?? []) as string[];
  const isSuper = roles.includes("SUPER_ADMIN");

  const { isFetching, refetch } = useQuery({
    queryKey: ["igreja-menu-refreshme"],
    queryFn: async () => {
      await refreshMe(true);
      return true;
    },
    enabled: false,
  });

  const visibleItems = useMemo(() => {
    return MENU.filter((item) => {
      if (isSuper) return true;
      if (item.requirePermission) {
        if (!hasPermission(permissions, item.requirePermission)) return false;
      }
      if (item.anyPermission) {
        return hasAnyPermission(permissions, item.anyPermission);
      }
      return true;
    });
  }, [permissions, isSuper]);

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handlePress = (item: MenuItemDef) => {
    router.push(item.href as any);
  };

  const renderItem = ({ item }: { item: MenuItemDef }) => (
    <View style={styles.gridItem}>
      <MinistryCard ministry={item.key} onPress={() => handlePress(item)} />
    </View>
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <LoadingSkeleton variant="gridCard" />
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Igreja"
        subtitle="Módulos e ferramentas"
        rightIcons={[
          {
            key: "bell",
            onPress: () => hasAnyPermission(permissions, ["notifications:read"]) || isSuper ? router.push("/igreja/notifications" as any) : undefined,
          },
        ]}
      />
      <ScreenContainer
        scrollable
        edges={["left", "right", "bottom"]}
        refreshing={isFetching}
        onRefresh={onRefresh}
      >
        {!initialized ? (
          renderSkeleton()
        ) : visibleItems.length === 0 ? (
          <EmptyState
            tint="info"
            title="Sem módulos disponíveis"
            description="Converse com a liderança para receber permissões de acesso aos módulos da igreja."
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        ) : (
          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.row}
            scrollEnabled={false}
            contentContainerStyle={styles.gridContent}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
          />
        )}
        <View style={{ height: theme.spacing.lg }} />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  gridContent: {
    flexGrow: 1,
  },
  row: {
    gap: theme.spacing.md,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
  },
  skeletonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
});
