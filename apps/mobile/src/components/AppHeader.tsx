import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { ChevronLeft, Search, Filter, Settings, Bell, Share2 } from "lucide-react-native";
import { theme } from "@/theme";

type RightIconKey = "search" | "filter" | "settings" | "bell" | "share";

interface RightIconDef {
  key: RightIconKey;
  onPress?: () => void;
}

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightIcons?: RightIconDef[];
  backgroundColor?: string;
  titleColor?: string;
}

const ICONS: Record<RightIconKey, React.ComponentType<{ color: string; size: number }>> = {
  search: Search,
  filter: Filter,
  settings: Settings,
  bell: Bell,
  share: Share2,
};

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  rightIcons,
  backgroundColor,
  titleColor,
}: AppHeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const bg = backgroundColor ?? theme.colors.background;
  const tc = titleColor ?? theme.colors.foreground;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[{ backgroundColor: bg }, styles.root]}>
      <View style={[styles.inner, { paddingTop: insets.top === 0 ? theme.spacing.md : theme.spacing.xs }]}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.canGoBack() && navigation.goBack()}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
              hitSlop={12}
            >
              <ChevronLeft size={22} color={tc} />
            </Pressable>
          ) : null}
          <View style={showBack ? { marginLeft: theme.spacing.sm } : null}>
            <Text numberOfLines={1} style={[styles.title, { color: tc }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.right}>
          {rightIcons?.map((r, i) => {
            const I = ICONS[r.key];
            return (
              <Pressable
                key={r.key}
                onPress={r.onPress}
                style={({ pressed }) => [
                  styles.iconBtn,
                  i < rightIcons.length - 1 && { marginRight: theme.spacing.sm },
                  pressed && { opacity: 0.65, transform: [{ scale: 0.94 }] },
                ]}
                hitSlop={10}
              >
                <I size={20} color={tc} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  inner: {
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { flex: 1, flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white08,
    alignItems: "center",
    justifyContent: "center",
  },
  right: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white08,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...theme.typography.title,
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    ...theme.typography.subtle,
    color: theme.colors.foregroundMuted,
    marginTop: 2,
  },
});
