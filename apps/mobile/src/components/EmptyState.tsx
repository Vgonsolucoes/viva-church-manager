import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { Button } from "@/components/Button";

export function EmptyState({
  icon = "cube-outline",
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={42} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button variant="outline" size="sm" onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
    marginBottom: 6,
  },
  title: {
    fontSize: theme.font.lg,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
    textAlign: "center",
  },
  desc: {
    fontSize: theme.font.sm,
    color: theme.colors.muted,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  action: { marginTop: 10 },
});
