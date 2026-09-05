import React from "react";
import { View, StyleSheet, ScrollView, RefreshControl, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { theme } from "@/theme";

interface ScreenContainerProps {
  children: React.ReactNode;
  padded?: boolean;
  paddingHorizontal?: number;
  noTopPadding?: boolean;
  scrollable?: boolean;
  backgroundColor?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  keyboardAvoiding?: boolean;
  style?: any;
  contentStyle?: any;
}

export function ScreenContainer({
  children,
  padded = true,
  paddingHorizontal,
  noTopPadding = false,
  scrollable = true,
  backgroundColor,
  refreshing,
  onRefresh,
  edges = ["left", "right", "bottom"],
  keyboardAvoiding = true,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const bg = backgroundColor ?? theme.colors.background;
  const horiz = paddingHorizontal ?? (padded ? theme.spacing.lg : 0);
  const inner = (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: bg }, style]}>
      {scrollable ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: horiz,
              paddingTop: noTopPadding ? 0 : theme.spacing.md,
            },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary500}
                colors={[theme.colors.primary500]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            {
              flex: 1,
              paddingHorizontal: horiz,
              paddingTop: noTopPadding ? 0 : theme.spacing.md,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );

  if (!keyboardAvoiding) return inner;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48, flexGrow: 1 },
});
