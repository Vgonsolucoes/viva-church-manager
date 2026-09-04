import React, { useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";

export default function PerfilBiometriaScreen() {
  const [face, setFace] = useState(false);
  const [auto, setAuto] = useState(true);
  return (
    <Screen backgroundBrand title="Biometria">
      <Card elevated padding="lg">
        <View style={styles.icon}>
          <Ionicons name="finger-print" size={48} color={theme.colors.primary} />
        </View>
        <Text style={styles.header}>Desbloqueio seguro</Text>
        <Text style={styles.desc}>
          Na próxima etapa você poderá logar rapidamente com sua digital ou Face ID ao abrir o app, sem precisar digitar a senha toda vez.</Text>
      </Card>

      <Card elevated padding="none" style={{ marginTop: 14 }}>
        <Row
          label="Desbloquear com biometria"
          value={face}
          onValueChange={(v) => {
            setFace(v);
            Alert.alert("Em breve", "A configuração de biometria chegará na próxima etapa.");
          }}
          desc="Digital / Face ID"
          icon="finger-print"
        />
        <View style={styles.divider} />
        <Row
          label="Solicitar biometria"
          value={auto}
          onValueChange={setAuto}
          desc="Sempre que abrir o app"
          icon="lock-open-outline"
        />
      </Card>
    </Screen>
  );
}

function Row({
  label,
  desc,
  value,
  onValueChange,
  icon,
}: {
  label: string;
  desc: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Switch
        value={value} onValueChange={onValueChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor={value ? "#FFFFFF" : "#FFFFFF"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primarySoft,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
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
  row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
  iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
  rowTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.foregroundDark,
    },
  rowDesc: {
      marginTop: 2,
      fontSize: 12,
      color: theme.colors.muted,
    },
  divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 16,
    },
});
