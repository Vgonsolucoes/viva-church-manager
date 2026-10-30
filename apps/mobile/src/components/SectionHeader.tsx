import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useAppTheme } from "@/theme";
import { useThemedStyles } from "@/theme";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  tint?: string;
  style?: any;
}

export function SectionHeader({ title, actionLabel, onActionPress, tint, style }: SectionHeaderProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles, theme);

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, tint && { color: tint }]}>{title}</Text>
      {actionLabel ? (
        <Pressable
          onPress={onActionPress}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <ChevronRight size={16} color={theme.colors.primary400} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => (StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
  },
  title: { ...theme.typography.section, color: theme.colors.foreground },
  action: { flexDirection: "row", alignItems: "center" },
  actionLabel: {
    ...theme.typography.subtleBold,
    color: theme.colors.primary400,
    marginRight: 2,
  },
}));
