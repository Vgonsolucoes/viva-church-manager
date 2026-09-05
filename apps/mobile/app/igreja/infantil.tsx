import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, FlatList } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby,
  GraduationCap,
  Users,
  Phone,
  ShieldCheck,
  LogIn,
  TicketCheck,
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
import { getMyChildren, postCheckIn, postCheckOut } from "@/services/api/kids";
import type { Child, ChildCheckIn } from "@/types";
import { formatDate } from "@/utils/date";

export default function IgrejaInfantilScreen() {
  const queryClient = useQueryClient();
  const [activeCheckIns, setActiveCheckIns] = useState<Record<string, ChildCheckIn>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["my-children"],
    queryFn: () => getMyChildren(),
    staleTime: 60_000,
  });

  const checkInMut = useMutation({
    mutationFn: (childId: string) => postCheckIn(childId),
    onSuccess: (res, childId) => {
      setActiveCheckIns((prev) => ({ ...prev, [childId]: res }));
      void queryClient.invalidateQueries({ queryKey: ["my-children"] });
      setToast({
        type: "success",
        text: `Check-in realizado! Código de retirada: ${res.pickupCode}`,
      });
      setTimeout(() => setToast(null), 3500);
    },
    onError: (e) => {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Não foi possível fazer o check-in.",
      });
      setTimeout(() => setToast(null), 3500);
    },
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const children = data ?? [];

  const renderItem = ({ item }: { item: Child }) => {
    const active = activeCheckIns[item.id];
    const isChecked = active?.status === "CHECKED_IN";

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
        </View>

        <View style={styles.checkInSection}>
          {isChecked ? (
            <View style={{ gap: theme.spacing.md }}>
              <View style={styles.checkInInfo}>
                <View style={styles.checkInInfoRow}>
                  <TicketCheck size={16} color={theme.colors.green500} />
                  <Text style={styles.checkInCodeLabel}>Código de retirada</Text>
                  <Text style={styles.checkInCode}>{active.pickupCode}</Text>
                </View>
              </View>
              <SecondaryButton
                title="Fazer check-out"
                variant="outline"
                height={46}
                loading={checkInMut.isPending}
                onPress={() => {
                  if (!active) return;
                  setActiveCheckIns((prev) => {
                    const next = { ...prev };
                    delete next[item.id];
                    return next;
                  });
                  setToast({ type: "success", text: "Check-out realizado com sucesso!" });
                  setTimeout(() => setToast(null), 3000);
                }}
              />
            </View>
          ) : (
            <PrimaryButton
              title={checkInMut.variables === item.id && checkInMut.isPending ? "Processando..." : "FAZER CHECK-IN"}
              variant="solid"
              loading={checkInMut.variables === item.id && checkInMut.isPending}
              disabled={checkInMut.isPending}
              leftIcon={<LogIn size={18} color="#FFFFFF" />}
              onPress={() => checkInMut.mutate(item.id)}
            />
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
            description="Quando houver crianças vinculadas ao seu perfil, elas aparecerão aqui para check-in."
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        ) : (
          <FlatList
            data={children}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: theme.spacing.sm }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
          />
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
