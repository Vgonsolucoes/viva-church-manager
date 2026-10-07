import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Baby, CheckCircle2, TicketCheck, XCircle } from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { AppCard } from "@/components/AppCard";
import { Avatar } from "@/components/Avatar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { theme } from "@/theme";
import {
  getMyChildren,
  postKidsCheckin,
  validateKidsCheckinQr,
} from "@/services/api/kids";
import type { KidsCheckinResult } from "@/types";

export default function KidsCheckinScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<KidsCheckinResult | null>(null);

  const validateQuery = useQuery({
    queryKey: ["kids-checkin-validate", token],
    queryFn: () => validateKidsCheckinQr(String(token)),
    enabled: !!token,
    retry: false,
    staleTime: 0,
  });

  const childrenQuery = useQuery({
    queryKey: ["my-children"],
    queryFn: () => getMyChildren(),
    staleTime: 30_000,
  });

  const checkinMut = useMutation({
    mutationFn: (childIds: string[]) => postKidsCheckin(String(token), childIds),
    onSuccess: (res) => {
      setResult(res);
      void queryClient.invalidateQueries({ queryKey: ["my-children"] });
    },
  });

  const service = validateQuery.data ?? null;
  const children = childrenQuery.data ?? [];

  const selectable = useMemo(() => children.filter((c) => !c.pendingCheckIn), [children]);
  const selectedIds = useMemo(
    () => selectable.filter((c) => selected[c.id]).map((c) => c.id),
    [selectable, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  // Resultado final: códigos de retirada por criança
  if (result) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader title="Check-in realizado" subtitle={result.service.name} showBack />
        <ScreenContainer padded edges={["left", "right", "bottom"]} noTopPadding>
          <View style={styles.successHeader}>
            <CheckCircle2 size={40} color={theme.colors.green500} />
            <Text style={styles.successTitle}>
              {result.created > 0
                ? "Check-in realizado com sucesso!"
                : "Nenhum check-in foi realizado"}
            </Text>
            <Text style={styles.successSubtitle}>
              Apresente o código ao retirar seu filho(a).
            </Text>
          </View>

          {result.results.map((r) => (
            <AppCard key={r.childId} variant="default" style={{ marginBottom: theme.spacing.md }}>
              <View style={styles.resultRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{r.childName}</Text>
                  {r.ok ? (
                    <View style={styles.resultCodeRow}>
                      <TicketCheck size={14} color={theme.colors.green500} />
                      <Text style={styles.resultCodeLabel}>Código de retirada</Text>
                    </View>
                  ) : (
                    <View style={styles.resultCodeRow}>
                      <XCircle size={14} color={theme.colors.danger500} />
                      <Text style={styles.resultErrorText}>{r.message}</Text>
                    </View>
                  )}
                </View>
                {r.ok && r.pickupCode ? (
                  <Text style={styles.resultCode}>{r.pickupCode}</Text>
                ) : null}
              </View>
            </AppCard>
          ))}

          <PrimaryButton
            title="Concluir"
            variant="solid"
            style={{ marginTop: theme.spacing.md }}
            onPress={() => router.replace("/igreja/infantil")}
          />
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader
        title="Check-in Kids"
        subtitle={service ? `${service.name} • ${service.startTime}` : "Validando QR Code..."}
        showBack
      />
      <ScreenContainer padded edges={["left", "right", "bottom"]} noTopPadding>
        {validateQuery.isLoading || childrenQuery.isLoading ? (
          <View style={{ gap: theme.spacing.lg }}>
            <LoadingSkeleton variant="card" />
            <LoadingSkeleton variant="card" />
          </View>
        ) : validateQuery.isError ? (
          <ErrorState
            title="Não foi possível fazer o check-in"
            message={
              validateQuery.error instanceof Error
                ? validateQuery.error.message
                : "QR Code inválido."
            }
            onRetry={() => router.back()}
          />
        ) : selectable.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Baby size={40} color={theme.colors.foregroundMuted} />
            <Text style={styles.emptyTitle}>
              {children.length === 0
                ? "Nenhum filho(a) cadastrado"
                : "Todos os seus filhos já estão no Kids"}
            </Text>
            {children.length === 0 ? (
              <SecondaryButton
                title="Cadastrar filho(a)"
                onPress={() => router.push("/igreja/kids-cadastro")}
                style={{ backgroundColor: theme.colors.primary500, marginTop: theme.spacing.md }}
                textStyle={{ color: "#FFFFFF" }}
              />
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.selectHint}>Selecione quem vai ficar no Kids:</Text>

            {selectable.map((child) => {
              const isSelected = !!selected[child.id];
              return (
                <Pressable key={child.id} onPress={() => toggle(child.id)}>
                  <AppCard
                    variant="default"
                    style={
                      isSelected
                        ? [styles.childCard, { borderColor: theme.colors.primary400, borderWidth: 1.5 }]
                        : styles.childCard
                    }
                  >
                    <View style={styles.childRow}>
                      <Avatar
                        src={child.photoUrl}
                        name={child.fullName}
                        size="lg"
                        ringColor={isSelected ? theme.colors.primary400 : theme.colors.white16}
                        ringWidth={2}
                      />
                      <Text style={styles.childName} numberOfLines={1}>
                        {child.fullName}
                      </Text>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && {
                            backgroundColor: theme.colors.primary500,
                            borderColor: theme.colors.primary500,
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Text style={styles.checkboxMark}>✓</Text>
                        ) : null}
                      </View>
                    </View>
                  </AppCard>
                </Pressable>
              );
            })}

            {children.some((c) => c.pendingCheckIn) ? (
              <Text style={styles.alreadyText}>
                {children
                  .filter((c) => c.pendingCheckIn)
                  .map((c) => `${c.fullName} já está no Kids.`)
                  .join(" ")}
              </Text>
            ) : null}

            {checkinMut.isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {checkinMut.error instanceof Error
                    ? checkinMut.error.message
                    : "Não foi possível concluir o check-in."}
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              title={
                checkinMut.isPending
                  ? "Confirmando..."
                  : `Confirmar check-in${selectedIds.length ? ` (${selectedIds.length})` : ""}`
              }
              variant="solid"
              disabled={selectedIds.length === 0 || checkinMut.isPending}
              loading={checkinMut.isPending}
              style={{ marginTop: theme.spacing.md }}
              onPress={() => checkinMut.mutate(selectedIds)}
            />
          </>
        )}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  selectHint: {
    ...theme.typography.subtleBold,
    color: theme.colors.foregroundMuted,
    marginBottom: theme.spacing.md,
  },
  childCard: { marginBottom: theme.spacing.md },
  childRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  childName: { flex: 1, color: "#FFFFFF", ...theme.typography.card },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.white16,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxMark: { color: "#FFFFFF", fontFamily: theme.fontFamilies.bold, fontSize: 14 },
  alreadyText: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  errorBox: {
    marginTop: theme.spacing.md,
    backgroundColor: "rgba(240,68,56,0.10)",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(240,68,56,0.30)",
  },
  errorText: { color: theme.colors.danger500, ...theme.typography.body, textAlign: "center" },
  emptyWrap: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxxxl,
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
    textAlign: "center",
  },
  successHeader: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
  successTitle: {
    ...theme.typography.heading,
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    textAlign: "center",
  },
  successSubtitle: {
    ...theme.typography.body,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  resultName: { color: "#FFFFFF", ...theme.typography.bodyBold },
  resultCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  resultCodeLabel: { ...theme.typography.caption, color: theme.colors.foregroundMuted },
  resultErrorText: { ...theme.typography.caption, color: theme.colors.danger500 },
  resultCode: {
    color: theme.colors.green500,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 24,
  },
});
