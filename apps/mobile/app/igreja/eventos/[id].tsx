import React, { useCallback, useState } from "react";
import { Image, Modal, StyleSheet, Text, View, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { getEventDetail, postRegistration } from "@/services/api/events";
import {
  formatCurrencyBRL,
  formatDateTime,
} from "@/utils/date";
import type { EventPublic } from "@/types";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showResult, setShowResult] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["event-detail", id],
    queryFn: () => getEventDetail(id as string),
    staleTime: 60_000,
    enabled: !!id,
  });

  const registerMut = useMutation({
    mutationFn: (eventId: string) => postRegistration(eventId),
    onSuccess: () => {
      setShowResult({ ok: true, text: "Inscrição confirmada! Verifique seu e-mail para mais detalhes." });
      void queryClient.invalidateQueries({ queryKey: ["event-detail"] });
    },
    onError: (e) => {
      setShowResult({
        ok: false,
        text: e instanceof Error ? e.message : "Não foi possível realizar a inscrição.",
      });
    },
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <Screen backgroundBrand loading>
        <View />
      </Screen>
    );
  }

  const ev = data as EventPublic | null;
  if (!ev) {
    return (
      <Screen backgroundBrand title="Evento não encontrado" refreshing={isFetching} onRefresh={onRefresh}>
        <Card elevated padding="lg">
          <Text style={styles.notFound}>
            Não foi possível carregar os detalhes desse evento. Tente novamente mais tarde.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: ev.name.length > 28 ? "Detalhe do evento" : ev.name }} />
      <Screen
        backgroundBrand
        padded={false}
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.bannerWrap}>
            {ev.bannerImageUrl ? (
              <Image
                source={{ uri: ev.bannerImageUrl }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Ionicons name="calendar" size={56} color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={styles.title}>{ev.name}</Text>
            <Card elevated padding="lg">
              <DetailRow icon="calendar-outline" label="Data e horário">
                <Text style={styles.detailValue}>
                  {formatDateTime(ev.startsAt)}
                </Text>
              </DetailRow>
              {ev.endsAt ? (
                <DetailRow icon="time-outline" label="Término previsto">
                  <Text style={styles.detailValue}>{formatDateTime(ev.endsAt)}</Text>
                </DetailRow>
              ) : null}
              {ev.location ? (
                <DetailRow icon="location-outline" label="Local">
                  <Text style={styles.detailValue}>{ev.location}</Text>
                </DetailRow>
              ) : null}
              {ev.type ? (
                <DetailRow icon="pricetag-outline" label="Tipo">
                  <Text style={styles.detailValue}>{ev.type}</Text>
                </DetailRow>
              ) : null}
              {ev.capacity != null ? (
                <DetailRow icon="people-outline" label="Capacidade">
                  <Text style={styles.detailValue}>{ev.capacity} lugares</Text>
                </DetailRow>
              ) : null}
              {ev.isPaid && ev.ticketPriceCents != null ? (
                <DetailRow icon="ticket-outline" label="Ingresso">
                  <Text style={[styles.detailValue, { color: theme.colors.accent, fontWeight: "800" }]}>
                    {formatCurrencyBRL(ev.ticketPriceCents)}
                    {ev.allowPix ? " · Pix" : ""}
                    {ev.allowCreditCard ? " · Cartão" : ""}
                  </Text>
                </DetailRow>
              ) : null}
            </Card>
            <Button
              size="lg"
              variant="primary"
              loading={registerMut.isPending}
              leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
              onPress={() => registerMut.mutate(ev.id)}
            >
              INSCREVER-SE
            </Button>
          </View>
        </ScrollView>
      </Screen>

      {showResult ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowResult(null)}>
          <View style={styles.resultOverlay}>
            <Card style={styles.resultCard} elevated padding="lg">
              <View
                style={[
                  styles.resultIcon,
                  { backgroundColor: showResult.ok ? theme.colors.success : theme.colors.destructiveSoft },
                ]}
              >
                <Ionicons
                  name={showResult.ok ? "checkmark" : "alert-circle-outline"}
                  size={32}
                  color={showResult.ok ? "#FFFFFF" : theme.colors.destructive}
                />
              </View>
              <Text style={styles.resultTitle}>
                {showResult.ok ? "Sucesso" : "Atenção"}
              </Text>
              <Text style={styles.resultText}>{showResult.text}</Text>
              <Button variant="primary" onPress={() => setShowResult(null)}>
                Ok, entendi
              </Button>
            </Card>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    width: "100%",
    height: 220,
    backgroundColor: theme.colors.secondary,
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 28,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: theme.colors.foregroundDark,
    fontWeight: "600",
  },
  notFound: {
    color: theme.colors.foregroundDark,
    fontSize: 14,
    textAlign: "center",
  },
  resultOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  resultCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 12,
  },
  resultIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  resultText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: "center",
    paddingHorizontal: 10,
    marginBottom: 8,
    lineHeight: 20,
  },
});

// Keep LoadingSpinner referenced
void LoadingSpinner;
