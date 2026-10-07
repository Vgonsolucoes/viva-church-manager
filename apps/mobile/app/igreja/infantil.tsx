import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, FlatList } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Baby,
  GraduationCap,
  Phone,
  ShieldCheck,
  QrCode,
  TicketCheck,
  UserPlus,
  Pencil,
} from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { AppCard } from "@/components/AppCard";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { theme } from "@/theme";
import { getMyChildren, postCheckOut } from "@/services/api/kids";
import type { Child } from "@/types";
import { formatDate } from "@/utils/date";

export default function IgrejaInfantilScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["my-children"],
    queryFn: () => getMyChildren(),
    staleTime: 30_000,
  });

  const checkOutMut = useMutation({
    mutationFn: (vars: { checkInId: string; pickupCode: string }) =>
      postCheckOut(vars.checkInId, vars.pickupCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-children"] });
      setToast({ type: "success", text: "Check-out realizado com sucesso!" });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (e) => {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Não foi possível fazer o check-out.",
      });
      setTimeout(() => setToast(null), 3500);
    },
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const children = data ?? [];

  const renderItem = ({ item }: { item: Child }) => {
    const active = item.pendingCheckIn ?? null;
    const isChecked = !!active && active.status === "CHECKED_IN";

    return (
      <AppCard variant="default" style={{ marginBottom: theme.spacing.lg }}>
        <View style={styles.childHeader}>
          <Avatar
            src={item.photoUrl}
            name={item.fullName}
            size="lg"
            ringColor={isChecked ? theme.colors.green500 : theme.colors.primary400}
            ringWidth={2.5}
          />
          <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
            <Text style={styles.childName} numberOfLines={1}>
              {item.fullName}
            </Text>
            <View style={styles.childMetaRow}>
              <GraduationCap size={14} color={theme.colors.primary400} />
              <Text style={styles.childMetaText}>
                {item.classroom ?? "Turma não definida"}
              </Text>
            </View>
            {item.birthDate ? (
              <View style={styles.childMetaRow}>
                <Baby size={14} color={theme.colors.purple400} />
                <Text style={styles.childMetaText}>
                  {formatDate(item.birthDate)}
                </Text>
              </View>
            ) : null}
          </View>
          {isChecked ? (
            <Badge label="No ambiente" variant="success" />
          ) : (
            <Badge label="Ausente" variant="muted" />
          )}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/igreja/kids-cadastro",
                params: { childId: item.id },
              })
            }
            hitSlop={8}
            style={({ pressed }) => [
              styles.editButton,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityLabel={`Editar ${item.fullName}`}
          >
            <Pencil size={16} color={theme.colors.foregroundMuted} />
          </Pressable>
        </View>

        <View style={styles.checkInSection}>
          {isChecked && active ? (
            <View style={{ gap: theme.spacing.md }}>
              <View style={styles.checkInInfo}>
                <View style={styles.checkInInfoRow}>
                  <TicketCheck size={16} color={theme.colors.green500} />
                  <Text style={styles.checkInCodeLabel}>Código de retirada</Text>
                  <Text style={styles.checkInCode}>{active.pickupCode}</Text>
                </View>
              </View>
              <SecondaryButton
                title={checkOutMut.isPending ? "Processando..." : "Fazer check-out"}
                variant="outline"
                height={46}
                loading={checkOutMut.isPending}
                disabled={checkOutMut.isPending}
                onPress={() =>
                  checkOutMut.mutate({
                    checkInId: active.id,
                    pickupCode: active.pickupCode,
                  })
                }
              />
            </View>
          ) : (
            <View style={styles.scanHintRow}>
              <QrCode size={15} color={theme.colors.foregroundMuted} />
              <Text style={styles.scanHintText}>
                Check-in disponível escaneando o QR Code na entrada do Kids.
              </Text>
            </View>
          )}
        </View>

        {item.guardians?.length ? (
          <View style={styles.guardiansSection}>
            <View style={styles.guardiansHeader}>
              <ShieldCheck size={16} color={theme.colors.primary400} />
              <Text style={styles.guardiansTitle}>Responsáveis autorizados</Text>
            </View>
            {item.guardians.map((g) => (
              <View key={g.id} style={styles.guardianRow}>
                <Avatar
                  src={null}
                  name={g.fullName}
                  size="md"
                  ringWidth={1}
                  ringColor={theme.colors.white16}
                />
                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Text style={styles.guardianName} numberOfLines={1}>
                    {g.fullName}
                  </Text>
                  <View style={styles.guardianMeta}>
                    {g.relationship ? (
                      <Badge label={g.relationship} variant="cyan" style={{ marginRight: theme.spacing.sm }} />
                    ) : null}
                    {g.phone ? (
                      <View style={styles.phoneRow}>
                        <Phone size={12} color={theme.colors.foregroundMuted} />
                        <Text style={styles.phoneText}>{g.phone}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </AppCard>
    );
  };

  return (
    <>
      <AppHeader title="Ministério Infantil" subtitle={`${children.length} ${children.length === 1 ? "filho(a)" : "filhos(as)"}`} showBack />
      <ScreenContainer
        scrollable={false}
        padded
        edges={["left", "right", "bottom"]}
        noTopPadding
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
        contentStyle={{ paddingBottom: theme.spacing.xxxxl }}
      >
        {isLoading ? (
          <View style={{ gap: theme.spacing.lg }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <View key={i} style={{ gap: theme.spacing.md }}>
                <LoadingSkeleton variant="card" />
              </View>
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title="Não foi possível carregar os filhos"
            message="Tente novamente em alguns instantes."
            onRetry={onRefresh}
          />
        ) : children.length === 0 ? (
          <EmptyState
            tint="cells"
            title="Nenhum filho vinculado"
            description="Cadastre seu filho(a) para realizar o check-in no Ministério Infantil."
            actionLabel="Cadastrar filho(a)"
            onAction={() => router.push("/igreja/kids-cadastro")}
          />
        ) : (
          <>
            <PrimaryButton
              title="Fazer check-in"
              variant="solid"
              leftIcon={<QrCode size={18} color="#FFFFFF" />}
              onPress={() => router.push("/igreja/kids-scan")}
              style={{ marginTop: theme.spacing.sm }}
            />
            <Pressable
              style={({ pressed }) => [
                styles.registerRow,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push("/igreja/kids-cadastro")}
            >
              <UserPlus size={16} color={theme.colors.primary400} />
              <Text style={styles.registerText}>Cadastrar filho(a)</Text>
            </Pressable>
            <FlatList
              data={children}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingTop: theme.spacing.sm }}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
            />
          </>
        )}
      </ScreenContainer>

      {toast ? (
        <View
          style={[
            styles.toast,
            toast.type === "success"
              ? { backgroundColor: theme.colors.green500 }
              : { backgroundColor: theme.colors.danger500 },
          ]}
        >
          <Text style={styles.toastText} numberOfLines={3}>
            {toast.text}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.primary400,
  },
  registerText: {
    ...theme.typography.bodyBold,
    color: theme.colors.primary400,
  },
  editButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  childHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  childName: {
    color: "#FFFFFF",
    ...theme.typography.card,
  },
  childMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  childMetaText: {
    color: theme.colors.foregroundMuted,
    ...theme.typography.subtle,
  },
  checkInSection: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.white08,
  },
  checkInInfo: {
    backgroundColor: "rgba(34,201,149,0.08)",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(34,201,149,0.20)",
  },
  checkInInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  checkInCodeLabel: {
    ...theme.typography.subtleBold,
    color: theme.colors.foregroundMuted,
    flex: 1,
  },
  checkInCode: {
    color: theme.colors.green500,
    ...theme.typography.heading,
    fontSize: 20,
    fontFamily: theme.fontFamilies.bold,
  },
  scanHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  scanHintText: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
    flex: 1,
  },
  guardiansSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.white08,
    gap: theme.spacing.md,
  },
  guardiansHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  guardiansTitle: {
    ...theme.typography.subtleBold,
    color: theme.colors.foregroundMuted,
    letterSpacing: 0.2,
  },
  guardianRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  guardianName: {
    color: "#FFFFFF",
    ...theme.typography.bodyBold,
  },
  guardianMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  phoneText: {
    color: theme.colors.foregroundMuted,
    ...theme.typography.caption,
  },
  toast: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xxl,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 100,
  },
  toastText: {
    color: "#FFFFFF",
    ...theme.typography.bodyBold,
    textAlign: "center",
  },
});
