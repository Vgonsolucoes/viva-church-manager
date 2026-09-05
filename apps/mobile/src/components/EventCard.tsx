import React from "react";
import { View, Text, StyleSheet, ImageBackground, Pressable, Dimensions, Image } from "react-native";
import { MapPin } from "lucide-react-native";
import { theme } from "@/theme";
import { AppCard } from "./AppCard";
import { Badge } from "./Badge";
import { PrimaryButton } from "./PrimaryButton";

const DIM = Dimensions.get("window");

export interface EventCardData {
  id: string;
  title: string;
  dateLabel?: string;
  dateStartLabel?: string;
  dateEndLabel?: string;
  monthShort?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  category?: "CONFERENCIA" | "CULTO" | "EVENTO" | "RETIRO" | string;
  registrationOpen?: boolean;
}

interface EventCardProps {
  data: EventCardData;
  onParticipate?: () => void;
  onView?: () => void;
  compact?: boolean;
  loading?: boolean;
}

export function EventCard({ data, onParticipate, onView, compact }: EventCardProps) {
  const variant: "primary" | "purple" | "cyan" | "orange" | "pink" =
    data.category === "CONFERENCIA"
      ? "purple"
      : data.category === "CULTO"
      ? "primary"
      : data.category === "RETIRO"
      ? "cyan"
      : data.category === "EVENTO"
      ? "pink"
      : "orange";

  const width = compact ? DIM.width - theme.spacing.lg * 2 - theme.spacing.md : "100%";

  return (
    <Pressable
      onPress={onView}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
    >
      <AppCard variant="default" padding={0} style={{ overflow: "hidden" }}>
        <View>
          {data.imageUrl ? (
            <ImageBackground
              source={{ uri: data.imageUrl }}
              style={styles.imageBg}
              imageStyle={{ opacity: 0.55 }}
            >
              {data.dateStartLabel || data.monthShort ? (
                <View style={styles.dateBadgeBox}>
                  <Text style={styles.dateBadgeTop}>
                    {[data.dateStartLabel, data.dateEndLabel].filter(Boolean).join(" - ")}
                  </Text>
                  <Text style={styles.dateBadgeBottom}>{data.monthShort}</Text>
                </View>
              ) : null}
            </ImageBackground>
          ) : (
            <View style={[styles.imageBg, styles.imagePlaceholder]}>
              {data.dateStartLabel || data.monthShort ? (
                <View style={styles.dateBadgeBox}>
                  <Text style={styles.dateBadgeTop}>
                    {[data.dateStartLabel, data.dateEndLabel].filter(Boolean).join(" - ")}
                  </Text>
                  <Text style={styles.dateBadgeBottom}>{data.monthShort}</Text>
                </View>
              ) : null}
            </View>
          )}
          <View style={styles.body}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Badge
                label={
                  data.category === "CONFERENCIA"
                    ? "CONFERÊNCIA"
                    : data.category === "CULTO"
                    ? "CULTO"
                    : data.category === "RETIRO"
                    ? "RETIRO"
                    : data.category === "EVENTO"
                    ? "EVENTO"
                    : "EVENTO"
                }
                variant={variant}
              />
              {data.dateLabel ? (
                <Text style={styles.dateLabel}>{data.dateLabel}</Text>
              ) : null}
            </View>
            <Text numberOfLines={compact ? 1 : 2} style={styles.title}>
              {data.title}
            </Text>
            {data.location ? (
              <View style={styles.metaRow}>
                <MapPin size={14} color={theme.colors.foregroundMuted} />
                <Text numberOfLines={1} style={styles.metaText}>
                  {data.location}
                </Text>
              </View>
            ) : null}
            {!compact && data.description ? (
              <Text numberOfLines={2} style={styles.desc}>
                {data.description}
              </Text>
            ) : null}
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton
                variant="solid"
                title={data.registrationOpen === false ? "Inscrições encerradas" : "Quero participar"}
                onPress={onParticipate}
                disabled={data.registrationOpen === false}
              />
            </View>
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageBg: { width: "100%", height: 170, backgroundColor: theme.colors.cardDark },
  imagePlaceholder: {
    backgroundColor: theme.colors.cardDark,
  },
  dateBadgeBox: {
    position: "absolute",
    top: theme.spacing.md,
    right: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    borderColor: theme.colors.cardOutline,
    alignItems: "center",
  },
  dateBadgeTop: { color: "#FFFFFF", fontFamily: theme.fontFamilies.bold, fontSize: 13, lineHeight: 16 },
  dateBadgeBottom: {
    color: theme.colors.primary400,
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  body: { padding: theme.spacing.lg },
  title: {
    ...theme.typography.card,
    color: "#FFFFFF",
    marginTop: theme.spacing.sm,
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: theme.spacing.sm },
  metaText: {
    ...theme.typography.subtle,
    color: theme.colors.foregroundMuted,
    marginLeft: 6,
    flex: 1,
  },
  desc: {
    ...theme.typography.bodySm,
    color: theme.colors.foregroundMuted,
    marginTop: theme.spacing.sm,
  },
  dateLabel: {
    ...theme.typography.captionBold,
    color: theme.colors.foregroundMuted,
  },
});
