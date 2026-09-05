import React, { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import { RefreshCw, Users } from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Avatar } from "@/components/Avatar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme } from "@/theme";
import { useAuth } from "@/hooks/useAuth";
import { getMemberCard, refreshMemberCard } from "@/services/api/qr";

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
  const joinedDate = me?.member?.joinedAt;
  const joinedYear = joinedDate ? new Date(joinedDate).getFullYear() : null;

  return (
    <ScreenContainer
      edges={["top", "left", "right", "bottom"]}
      refreshing={isFetching && !loading}
      onRefresh={onRefresh}
      padded={true}
      contentStyle={{ alignItems: "center", paddingBottom: theme.spacing.xxxxl }}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Minha Carteirinha</Text>
        <Text style={styles.headerSubtitle}>Cartão de membro premium</Text>
      </View>

      {error && !loading ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>
            {(error as Error).message || "Erro ao carregar carteirinha."}
          </Text>
        </View>
      ) : null}

      <View style={[styles.cardShadowWrap, Platform.OS === "android" && { elevation: 10 }]}>
        <LinearGradient
          colors={[theme.colors.gradientFrom, theme.colors.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardInner}>
            <View style={styles.cardTopRow}>
              <View style={styles.logoWrap}>
                <Text style={styles.logoText}>V</Text>
              </View>
              <View style={styles.brandSide}>
                <Text style={styles.brandName}>VIVA CHURCH</Text>
                <Text style={styles.brandSub}>Membro Premium</Text>
              </View>
            </View>

            <View style={styles.avatarCenterWrap}>
              <Avatar
                src={card?.photoUrl ?? me?.member?.photoUrl ?? me?.image}
                name={card?.fullName ?? me?.member?.fullName ?? me?.name}
                size="xl"
                ringColor="rgba(255,255,255,0.35)"
                ringWidth={3}
                style={styles.centerAvatar}
              />
            </View>

            <View style={styles.memberInfoWrap}>
              <Text style={styles.memberName} numberOfLines={2}>
                {card?.fullName ?? me?.member?.fullName ?? me?.name ?? "—"}
              </Text>
              <Text style={styles.memberSince}>
                {joinedYear ? `Membro desde ${joinedYear}` : "Membro desde —"}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.qrContainer}>
                {loading && !card ? (
                  <View style={[styles.qrBg, styles.qrLoadingInner]}>
                    <LoadingSpinner size="small" />
                  </View>
                ) : card?.qrToken ? (
                  <View style={styles.qrBg}>
                    <QRCode
                      value={card.qrToken}
                      size={104}
                      color={theme.colors.background}
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                ) : (
                  <View style={[styles.qrBg, styles.qrEmpty]}>
                    <Users size={32} color={theme.colors.foregroundMuted} />
                  </View>
                )}
              </View>

              <View style={styles.numberColumn}>
                <Text style={styles.numberLabel}>Nº do membro</Text>
                <Text style={styles.numberValue}>
                  {card?.memberNumber ? `#${card.memberNumber}` : "#—"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={{ width: "100%", marginTop: theme.spacing.lg }}>
        <SecondaryButton
          title={refreshMutation.isPending ? "Atualizando..." : "Atualizar Carteirinha"}
          onPress={() => refreshMutation.mutate()}
        />
      </View>

      <Pressable style={styles.tipWrap} onPress={onRefresh} hitSlop={8}>
        <Text style={styles.tipText}>
          Arraste para baixo para recarregar os dados
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignSelf: "flex-start",
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  headerTitle: {
    ...theme.typography.titleLg,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.foregroundMuted,
    marginTop: theme.spacing.xs,
  },
  errorWrap: {
    width: "100%",
    padding: theme.spacing.md,
    backgroundColor: "rgba(240,68,56,0.12)",
    borderWidth: 1,
    borderColor: "rgba(240,68,56,0.25)",
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.bodySm,
    color: theme.colors.danger400,
    fontFamily: theme.fontFamilies.semibold,
  },
  cardShadowWrap: {
    width: "100%",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#473DFF",
        shadowOpacity: 0.34,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
    }),
  },
  cardGradient: {
    width: "100%",
    height: 520,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.white16,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: theme.fontFamilies.bold,
    lineHeight: 26,
    letterSpacing: 0.5,
  },
  brandSide: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  brandName: {
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    fontSize: 15,
    letterSpacing: 1.2,
  },
  brandSub: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: theme.fontFamilies.medium,
    fontSize: 12,
    marginTop: 2,
  },
  avatarCenterWrap: {
    alignItems: "center",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  centerAvatar: {
    zIndex: 2,
  },
  memberInfoWrap: {
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  memberName: {
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    marginBottom: 4,
  },
  memberSince: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: theme.fontFamilies.regular,
    fontSize: 13,
    textAlign: "center",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingHorizontal: theme.spacing.sm,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrBg: {
    width: 120,
    height: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  qrLoadingInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrEmpty: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
  },
  numberColumn: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  numberLabel: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: theme.fontFamilies.regular,
    fontSize: 11,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  numberValue: {
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    fontSize: 20,
    letterSpacing: 1,
  },
  tipWrap: {
    marginTop: theme.spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  tipText: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
    textAlign: "center",
  },
});
