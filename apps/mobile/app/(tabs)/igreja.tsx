import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useSessionStore } from "@/stores/session";
import { theme } from "@/constants/theme";
import { hasAnyPermission, hasPermission } from "@/permissions";
import { useAuth } from "@/hooks/useAuth";
import type { PermissionKey } from "@/types";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: IconName;
  tint: string;
  tintBg: string;
  href: string;
  anyPermission?: PermissionKey[];
  requirePermission?: PermissionKey;
}

const MENU: MenuItem[] = [
  {
    key: "events",
    label: "Eventos",
    description: "Cultos, conferências e encontros",
    icon: "calendar-star",
    tint: theme.colors.accent,
    tintBg: theme.colors.accentSoft,
    href: "/igreja/events",
    anyPermission: ["events:read", "calendar:read"],
  },
  {
    key: "cells",
    label: "Células",
    description: "Grupos pequenos e reuniões",
    icon: "account-group",
    tint: theme.colors.success,
    tintBg: "rgba(23,201,100,0.15)",
    href: "/igreja/cells",
    anyPermission: ["cells:read"],
  },
  {
    key: "discipleships",
    label: "Discipulado",
    description: "Acompanhamento e rede",
    icon: "book-open-page-variant",
    tint: theme.colors.warning,
    tintBg: "rgba(244,161,0,0.15)",
    href: "/igreja/discipleships",
    anyPermission: ["discipleships:read", "discipleship:my:read"],
  },
  {
    key: "ministries",
    label: "Ministérios",
    description: "Times de serviço e voluntariado",
    icon: "briefcase-account",
    tint: "#8B5CF6",
    tintBg: "rgba(139,92,246,0.15)",
    href: "/igreja/ministries",
    anyPermission: ["ministries:read"],
  },
  {
    key: "projects",
    label: "Projetos",
    description: "Campanhas e arrecadações",
    icon: "hand-heart",
    tint: "#0EA5E9",
    tintBg: "rgba(14,165,233,0.15)",
    href: "/igreja/projects",
    anyPermission: ["assets:read"],
  },
  {
    key: "prayer",
    label: "Pedido de Oração",
    description: "Compartilhe e interceda",
    icon: "heart-outline",
    tint: "#EC4899",
    tintBg: "rgba(236,72,153,0.15)",
    href: "/igreja/prayer",
    anyPermission: ["prayer:read", "prayer:write"],
  },
  {
    key: "qr-reader",
    label: "QR Leitor",
    description: "Check-in, eventos e membros",
    icon: "qrcode-scan",
    tint: theme.colors.primary,
    tintBg: theme.colors.primarySoft,
    href: "/igreja/qr-reader",
    anyPermission: ["events:read", "members:read", "schedules:confirm", "kids:checkin:self"],
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

  const handlePress = (item: MenuItem) => {
    router.push(item.href as any);
  };

  return (
    <Screen
      backgroundBrand
      padded={false}
      loading={!initialized}
      loadingLabel="Carregando..."
      refreshing={isFetching}
      onRefresh={onRefresh}
    >
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="church" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Igreja</Text>
            <Text style={styles.headerSub}>
              Módulos e ferramentas disponíveis
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.list}>
        {initialized && visibleItems.length === 0 ? (
          <EmptyState
            icon="lock-open-outline"
            title="Sem módulos disponíveis"
            description="Converse com a liderança para receber permissões de acesso aos módulos da igreja."
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        ) : null}

        {!initialized && visibleItems.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 30 }}>
            <LoadingSpinner size="large" />
          </View>
        ) : null}

        <Card elevated padding="none" style={styles.menuCard}>
          {visibleItems.map((item, idx) => (
            <React.Fragment key={item.key}>
              {idx > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                style={styles.menuItem}
                onPress={() => handlePress(item)}
                android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: item.tintBg }]}>
                  <MaterialCommunityIcons name={item.icon} size={22} color={item.tint} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.colors.muted}
                />
              </Pressable>
            </React.Fragment>
          ))}
        </Card>
      </View>

      <View style={{ height: 20 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  headerSub: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  list: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  menuCard: {
    width: "100%",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  menuDesc: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
});
