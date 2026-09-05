import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Platform, Easing } from "react-native";
import { theme } from "@/theme";

export type SkeletonVariant = "line" | "card" | "heroCard" | "gridCard" | "avatar" | "button" | "title";

const PRESETS: Record<SkeletonVariant, { width?: number | string; height: number; borderRadius: number }> = {
  line: { width: "100%", height: 14, borderRadius: 6 },
  card: { width: "100%", height: 110, borderRadius: theme.radius.card },
  heroCard: { width: "100%", height: 160, borderRadius: theme.radius.cardHero },
  gridCard: { width: "100%", height: 140, borderRadius: theme.radius.card },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  button: { width: "100%", height: 52, borderRadius: theme.radius.button },
  title: { width: 180, height: 22, borderRadius: 8 },
};

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function LoadingSkeleton({ variant = "line", width, height, borderRadius, style }: LoadingSkeletonProps) {
  const preset = PRESETS[variant];
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const id = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 600,
          useNativeDriver: Platform.OS !== "web",
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 600,
          useNativeDriver: Platform.OS !== "web",
          easing: Easing.inOut(Easing.quad),
        }),
      ]),
      { iterations: -1 }
    );
    id.start();
    return () => id.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width: width ?? preset.width,
          height: height ?? preset.height,
          borderRadius: borderRadius ?? preset.borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.skeletonHighlight,
    overflow: "hidden",
  },
});

export function SkeletonCardLines({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {Array.from({ length: lines }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          variant="line"
          width={i === 0 ? "100%" : i === lines - 1 ? "65%" : "85%"}
        />
      ))}
    </View>
  );
}
