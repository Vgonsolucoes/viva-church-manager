import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { useAuth } from "@/hooks/useAuth";
import { theme } from "@/constants/theme";
import { hasPermission } from "@/permissions";

export default function EscalasScreen() {
  const { me } = useAuth();
  const perms = me?.permissions ?? [];
  const roles = (me?.roles ?? []) as string[];
  const canRead = hasPermission(perms, "schedules:read") || roles.includes("SUPER_ADMIN");
  return (
    <Screen backgroundBrand title="Escalas">
      <Card elevated padding="lg">
        <View style={styles.iconWrap}>
          <Ionicons
            name={canRead ? "construct" : "lock-closed"} size={40} color={theme.colors.primary} />
        </View>
        <Text style={styles.header}>
          {canRead ? "Em breve" : "Acesso restrito"}
        </Text>
        <Text style={styles.desc}>
          {canRead
            ? "Sua página de escalas e escalas de voluntários chegará na próxima etapa do Viva Church App."
            : "Você ainda não tem permissão para ver as escalas. Se for líder, voluntário ou membro de ministério, peça ao administrador a liberação da permissão de leitura de escalas."}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    color: theme.colors.muted,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
  },
});
