import React, { useCallback } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Briefcase,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Avatar } from "@/components/Avatar";
import { AppCard } from "@/components/AppCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { theme } from "@/theme";
import { useAuth } from "@/hooks/useAuth";
import { getMyCell } from "@/services/api/cellsMy";

export default function PerfilScreen() {
  const router = useRouter();
  const { me, logout, loading, initialized, refreshMe } = useAuth();

  const cellQuery = useQuery({
    queryKey: ["my-cell"],
    queryFn: () => getMyCell(),
    staleTime: 60_000,
    enabled: !!initialized,
  });

  const onRefresh = useCallback(async () => {
    await refreshMe(true);
    await cellQuery.refetch();
  }, [refreshMe, cellQuery]);

  const ministries = me?.ministries ?? [];
  const hasCell = !!cellQuery.data;

  const menuRows = [
    {
      id: "ministries",
      label: "Meus ministérios",
      Icon: Briefcase,
      iconBg: "rgba(23,107,255,0.14)",
      iconColor: theme.colors.primary400,
      onPress: () => router.push("/igreja/ministerios" as any),
      danger: false,
      badge: ministries.length ? String(ministries.length) : null,
    },
    {
      id: "cell",
      label: "Minha célula",
      Icon: Users,
      iconBg: "rgba(34,201,149,0.14)",
      iconColor: theme.colors.green500,
      onPress: () => router.push("/igreja/celulas" as any),
      danger: false,
      badge: hasCell ? "Ativa" : null,
    },
    {
      id: "data",
      label: "Meus dados",
      Icon: ClipboardList,
      iconBg: "rgba(112,87,255,0.14)",
      iconColor: theme.colors.purple400,
      onPress: () => router.push("/perfil/editar"),
      danger: false,
      badge: null,
    },
    {
      id: "settings",
      label: "Configurações",
      Icon: Settings,
      iconBg: "rgba(243,155,66,0.14)",
      iconColor: theme.colors.orange500,
      onPress: () => {},
      danger: false,
      badge: null,
    },
    {
      id: "logout",
      label: "Sair",
      Icon: LogOut,
      iconBg: "rgba(240,68,56,0.14)",
      iconColor: theme.colors.danger500,
      onPress: () => logout(),
      danger: true,
      badge: null,
    },
  ];

  return (
    <ScreenContainer
      scrollable
      padded
      edges={["left", "right", "top", "bottom"]}
      refreshing={!initialized || cellQuery.isFetching}
      onRefresh={onRefresh}
      contentStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxxl }}
    >
      <View style={styles.heroSection}>
        {!initialized ? (
          <View style={styles.skeletonWrap}>
            <LoadingSkeleton variant="avatar" width={120} height={120} borderRadius={60} />
            <View style={{ gap: theme.spacing.sm, alignItems: "center", marginTop: theme.spacing.lg, width: "80%" }}>
              <LoadingSkeleton variant="line" width="70%" height={22} />
              <LoadingSkeleton variant="line" width="55%" height={14} />
            </View>
            <View style={{ marginTop: theme.spacing.xl, width: 200 }}>
              <LoadingSkeleton variant="button" />
            </View>
          </View>
        ) : (
          <>
            <Avatar
              src={me?.image ?? me?.member?.photoUrl}
              name={me?.name}
              size="xxl"
              ringColor={theme.colors.primary400}
              ringWidth={3}
            />
            <Text style={styles.name}>{me?.name ?? "Carregando..."}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {me?.email ?? "—"}
            </Text>
            <View style={styles.editBtnWrap}>
              <PrimaryButton
                title="Editar perfil"
                variant="small"
                onPress={() => router.push("/perfil/editar")}
                style={styles.editBtn}
              />
            </View>
          </>
        )}
      </View>

      <AppCard variant="default" padding={0} contentStyle={{ padding: 0 }}>
        {menuRows.map((row, idx) => {
          const { Icon, label, iconBg, iconColor, onPress, danger, badge } = row;
          return (
            <React.Fragment key={row.id}>
              <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                  styles.menuRow,
                  pressed && { transform: [{ scale: 0.975 }], opacity: 0.88 },
                ]}
              >
                <View
                  style={[
                    styles.menuIcon,
                    { backgroundColor: iconBg, borderRadius: 12 },
                  ]}
                >
                  <Icon size={22} color={iconColor} />
                </View>
                <Text
                  style={[
                    styles.menuLabel,
                    danger && { color: theme.colors.danger500 },
                  ]}
                >
                  {label}
                </Text>
                <View style={styles.rowRight}>
                  {badge ? (
                    <View
                      style={[
                        styles.rowBadge,
                        {
                          backgroundColor: danger
                            ? "rgba(240,68,56,0.14)"
                            : "rgba(23,107,255,0.14)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rowBadgeText,
                          { color: danger ? theme.colors.danger500 : theme.colors.primary400 },
                        ]}
                      >
                        {badge}
                      </Text>
                    </View>
                  ) : null}
                  <ChevronRight
                    size={20}
                    color={danger ? theme.colors.danger500 : theme.colors.foregroundMuted}
                  />
                </View>
              </Pressable>
              {idx < menuRows.length - 1 ? <View style={styles.divider} /> : null}
            </React.Fragment>
          );
        })}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    alignItems: "center",
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  skeletonWrap: {
    alignItems: "center",
    width: "100%",
    paddingTop: theme.spacing.sm,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: theme.fontFamilies.bold,
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
  email: {
    color: theme.colors.foregroundMuted,
    ...theme.typography.body,
    textAlign: "center",
  },
  editBtnWrap: {
    marginTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xxl,
    width: "100%",
    alignItems: "center",
  },
  editBtn: {
    width: 220,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    color: "#FFFFFF",
    ...theme.typography.bodyBold,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  rowBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  rowBadgeText: {
    ...theme.typography.captionBold,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.white08,
    marginHorizontal: theme.spacing.lg,
  },
});
