import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ViewStyle,
  StyleProp,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export interface ScreenProps {
  title?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollable?: boolean;
  noSafeArea?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
  backgroundBrand?: boolean;
  children?: React.ReactNode;
  loadingLabel?: string;
}

export function Screen({
  title,
  loading,
  refreshing,
  onRefresh,
  scrollable = true,
  noSafeArea,
  style,
  contentStyle,
  padded = true,
  backgroundBrand,
  children,
  loadingLabel,
}: ScreenProps) {
  const background = backgroundBrand
    ? { backgroundColor: theme.colors.background }
    : { backgroundColor: "#F2F5FB" };

  const content = (
    <>
      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          {loadingLabel ? (
            <Text style={styles.loadingLabel}>{loadingLabel}</Text>
          ) : null}
        </View>
      ) : scrollable ? (
        <ScrollView
          contentContainerStyle={[
            padded ? styles.padded : null,
            contentStyle,
            styles.scrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            ) : undefined
          }
        >
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </ScrollView>
      ) : (
        <View style={[padded ? styles.padded : null, contentStyle]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </View>
      )}
    </>
  );

  if (noSafeArea) {
    return <View style={[styles.root, background, style]}>{content}</View>;
  }

  return (
    <SafeAreaView style={[styles.root, background, style]} edges={["top"]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { padding: theme.spacing.lg },
  scrollContent: { flexGrow: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingLabel: {
    color: theme.colors.muted,
    fontSize: theme.font.sm,
  },
  title: {
    fontSize: theme.font.xxl,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
    marginBottom: theme.spacing.lg,
  },
});
