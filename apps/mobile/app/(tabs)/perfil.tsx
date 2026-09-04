import React, { useCallback } from "react";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { theme } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/utils/date";

export default function PerfilScreen() {
  const { me, logout, loading, initialized, refreshMe } = useAuth();
  const roles = (me?.roles ?? []) as string[];
  const permissions = me?.permissions ?? [];

  const onRefresh = useCallback(async () => {
    await refreshMe(true);
  }, [refreshMe]);

  return (
    <Screen
      backgroundBrand
      padded={false}
      refreshing={false}
      onRefresh={onRefresh}
      loading={!initialized}
      loadingLabel="Carregando perfil..."
    >
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Card elevated padding="lg">
          <View style={styles.hero}>
            <Avatar src={me?.image} name={me?.name} size={80} />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.name}>{me?.name ?? "Carregando..."}</Text>
              <Text style={styles.email} numberOfLines={1}>{me?.email ?? "—"}</Text>
              <View style={styles.chipRow}>
                {roles.slice(0, 3).map((r) => (
                  <View key={r} style={styles.roleChip}>
                    <Text style={styles.roleText}>{r.replace(/_/g, " ")}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Card>

        <Card elevated padding="lg">
          <Text style={styles.sectionHeader}>Dados do membro</Text>
          <InfoRow icon="person" label="Nome completo" value={me?.member?.fullName ?? "—"} />
          <InfoRow
            icon="calendar" label="Data de nascimento"
            value={me?.member?.birthDate ? formatDate(me.member.birthDate) : "—"} />
          <InfoRow icon="call" label="Telefone" value={me?.member?.phone ?? "—"} />
          <InfoRow
            icon="calendar-sharp" label="Batismo / Entrada"
            value={me?.member?.joinedAt ? formatDate(me.member.joinedAt) : "—"} />
        </Card>

        <Card elevated padding="lg">
          <Text style={styles.sectionHeader}>Meus ministérios</Text>
          {me?.ministries?.length ? (
            <View style={styles.ministries}>
              {me.ministries.map((m) => (
                <View key={m.id} style={styles.ministryChip}>
                  <Ionicons name="briefcase-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.ministryText}>{m.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>Sem ministérios vinculados.</Text>
          )}
        </Card>

        <Card elevated padding="lg">
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Permissões</Text>
            <Text style={styles.countBadge}>{permissions.length}</Text>
          </View>
          <View style={styles.permissionsGrid}>
            {permissions.length ? (
              permissions.slice(0, 18).map((p) => (
                <View key={p} style={styles.permItem}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                  <Text style={styles.permText} numberOfLines={1}>
                    {p}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>Nenhuma permissão adicional.</Text>
            )}
          </View>
        </Card>

        <Card elevated padding="none">
          <Link href="/perfil/biometria" asChild>
            <Pressable
              style={styles.listItem}
              android_ripple={{ color: theme.colors.primarySoft, borderless: false }}
            >
              <View style={styles.listIconWrap}>
                <Ionicons name="finger-print" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>Biometria</Text>
                <Text style={styles.listDesc}>Desbloqueie o app com digital ou Face ID</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </Pressable>
          </Link>
          <View style={styles.divider} />
          <Pressable
            style={styles.listItem}
            android_ripple={{ color: theme.colors.primarySoft, borderless: false }}
          >
            <View style={[styles.listIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>Notificações</Text>
              <Text style={styles.listDesc}>Em breve (pré-configurar preferências</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>
        </Card>

        <Button
          variant="destructive"
          style={{ marginTop: 6 }}
          size="lg"
          loading={loading}
          leftIcon={<Ionicons name="log-out-outline" size={18} color="#FFFFFF" />}
          onPress={() => logout()}
        >
          Sair da conta
        </Button>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({
  icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color={theme.colors.primary} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    color: theme.colors.foregroundDark,
    fontSize: 20,
    fontWeight: "800",
  },
  email: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 13,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 6 },
  roleChip: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: theme.colors.foregroundDark,
    marginBottom: 10,
  },
  countBadge: {
      fontSize: 11,
      fontWeight: "800",
      backgroundColor: theme.colors.primarySoft,
      color: theme.colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
  infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 8,
    },
  infoLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: "600" },
  infoValue: {
      marginTop: 2,
      color: theme.colors.foregroundDark,
      fontSize: 14,
      fontWeight: "600",
    },
  ministries: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
  ministryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.primarySoft,
    },
  ministryText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: "700",
    },
  muted: {
      color: theme.colors.muted,
      fontSize: 13,
    },
  permissionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
  permItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      width: "48%",
      paddingVertical: 4,
    },
  permText: {
      flex: 1,
      fontSize: 11,
      color: theme.colors.foregroundDark,
      fontWeight: "600",
    },
  listItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
  listIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
  listTitle: {
      color: theme.colors.foregroundDark,
      fontSize: 14,
      fontWeight: "700",
    },
  listDesc: {
      marginTop: 2,
      color: theme.colors.muted,
      fontSize: 12,
    },
  divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 16,
    },
});
