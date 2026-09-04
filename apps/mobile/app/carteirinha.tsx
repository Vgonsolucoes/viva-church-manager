import React, { useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { theme } from "@/constants/theme";
import { formatDate } from "@/utils/date";
import { getMemberCard, refreshMemberCard } from "@/services/api/qr";
import { Avatar } from "@/components/Avatar";

export default function CarteirinhaScreen() {
  const { me, initialized } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: card,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["qr-member-card"],
    queryFn: () => getMemberCard(),
    enabled: initialized && !!me,
    staleTime: 5 * 60_000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshMemberCard(),
    onSuccess: (data) => {
      queryClient.setQueryData(["qr-member-card"], data);
      Alert.alert("Atualizado", "Sua carteirinha foi atualizada.");
    },
    onError: (e) => {
      Alert.alert("Ops", (e as Error).message || "Não foi possível atualizar.");
    },
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const loading = isLoading || !initialized;

  return (
    <Screen
      backgroundBrand
      padded={false}
      loading={loading}
      loadingLabel="Carregando carteirinha..."
      refreshing={isFetching && !loading}
      onRefresh={onRefresh}
    >
      <View style={styles.container}>
        {error && !loading ? (
          <View style={styles.errorWrap}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={theme.colors.destructive} />
            <Text style={styles.errorText}>
              {(error as Error).message || "Erro ao carregar carteirinha. Arraste para atualizar."}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogoWrap}>
                <MaterialCommunityIcons name="church" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.brandName}>VIVA CHURCH</Text>
                <Text style={styles.brandSub}>Carteirinha de Membro</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.photoRow}>
              <Avatar
                src={card?.photoUrl ?? me?.member?.photoUrl ?? me?.image}
                name={card?.fullName ?? me?.member?.fullName ?? me?.name}
                size={84}
                style={styles.photo}
              />
              <View style={styles.infoCol}>
                <Text style={styles.name} numberOfLines={2}>
                  {card?.fullName ?? me?.member?.fullName ?? me?.name ?? "—"}
                </Text>
                <View style={styles.rowBadge}>
                  <Text style={styles.rowLabel}>Nº Membro</Text>
                  <Text style={styles.memberNumber}>
                    {card?.memberNumber ? `#${card.memberNumber}` : "—"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.qrWrap}>
              <View style={styles.qrInner}>
                {card?.qrToken ? (
                  <QRCode
                    value={card.qrToken}
                    size={200}
                    color={theme.colors.foregroundDark}
                    backgroundColor="#FFFFFF"
                  />
                ) : loading ? (
                  <View style={styles.qrLoading}>
                    <LoadingSpinner size="large" />
                  </View>
                ) : (
                  <View style={styles.qrEmpty}>
                    <MaterialCommunityIcons name="qrcode" size={64} color={theme.colors.muted} />
                    <Text style={styles.qrEmptyText}>Sem código</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.validityRow}>
              <View style={styles.validityCol}>
                <Text style={styles.validityLabel}>Validade</Text>
                <Text style={styles.validityValue}>
                  {card?.expiresAt ? formatDate(card.expiresAt) : "—"}
                </Text>
              </View>
              <View style={styles.validityColEnd}>
                <View style={[styles.statusDot, card && new Date(card.expiresAt) > new Date() ? styles.statusOk : styles.statusWarn]} />
                <Text style={[styles.statusText, card && new Date(card.expiresAt) > new Date() ? styles.statusOkText : styles.statusWarnText]}>
                  {card
                    ? new Date(card.expiresAt) > new Date()
                      ? "Válida"
                      : "Expirada"
                    : "—"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <MaterialCommunityIcons name="lock-check" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.footerText}>
              Apresente na entrada ou use o QR Code para check-in.
            </Text>
          </View>
        </View>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          style={styles.refreshBtn}
          loading={refreshMutation.isPending}
          leftIcon={
            <MaterialCommunityIcons
              name="refresh"
              size={18}
              color="#FFFFFF"
            />
          }
          onPress={() => refreshMutation.mutate()}
        >
          Atualizar Carteirinha
        </Button>

        <Pressable
          style={styles.tipWrap}
          onPress={onRefresh}
          android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
        >
          <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.muted} />
          <Text style={styles.tipText}>
            Arraste para baixo para recarregar os dados.
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  errorWrap: {
    padding: 12,
    backgroundColor: theme.colors.destructiveSoft,
    borderWidth: 1,
    borderColor: "rgba(240,68,56,0.25)",
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: theme.colors.destructive,
    fontSize: theme.font.sm,
    fontWeight: "600",
  },
  card: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "linear-gradient" as unknown as undefined,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: theme.colors.background,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1.2,
  },
  brandSub: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  cardBody: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  photo: {
    borderWidth: 3,
    borderColor: theme.colors.primarySoft,
  },
  infoCol: {
    flex: 1,
    gap: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  rowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  memberNumber: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
  },
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrInner: {
    width: 230,
    height: 230,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
  },
  qrLoading: {
    alignItems: "center",
    justifyContent: "center",
    width: 200,
    height: 200,
  },
  qrEmpty: {
    alignItems: "center",
    justifyContent: "center",
    width: 200,
    height: 200,
    gap: 8,
  },
  qrEmptyText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  validityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4,
  },
  validityCol: {
    gap: 2,
  },
  validityColEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  validityLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  validityValue: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOk: { backgroundColor: theme.colors.success },
  statusWarn: { backgroundColor: theme.colors.warning },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusOkText: { color: theme.colors.success },
  statusWarnText: { color: theme.colors.warning },
  cardFooter: {
    backgroundColor: theme.colors.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  footerText: {
    flex: 1,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
  },
  refreshBtn: {
    marginTop: 4,
  },
  tipWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tipText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "500",
  },
});

void Image;
