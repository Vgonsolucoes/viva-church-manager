import React, { useCallback } from "react";
import { View, StyleSheet, Text, Linking, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { AppCard } from "@/components/AppCard";
import { SecondaryButton } from "@/components/SecondaryButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionHeader } from "@/components/SectionHeader";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import {
  MapPin,
  Clock,
  Users,
  ChevronRight,
  User,
  ClipboardList,
} from "lucide-react-native";
import { theme } from "@/theme";
import { getMyCell } from "@/services/api/cellsMy";
import { listCellMembers, postAttendance } from "@/services/api/cellsV2";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission } from "@/permissions";
import type { CellDetail } from "@/types";

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function formatDayHour(cell: CellDetail): string {
  const parts: string[] = [];
  if (typeof cell.weekday === "number") parts.push(WEEKDAY_LABELS[cell.weekday] ?? "");
  if (cell.time) parts.push(cell.time);
  return parts.filter(Boolean).join(" • ") || "Horário a confirmar";
}

function openMap(address?: string | null) {
  if (!address) return;
  const q = encodeURIComponent(address);
  const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
  Linking.openURL(url).catch(() => {});
}

function countMembers(cell: CellDetail): number {
  const anyMembers = (cell as unknown as { members?: unknown[] }).members;
  if (Array.isArray(anyMembers)) return anyMembers.length;
  return cell.membersCount ?? 0;
}

function firstMembers(cell: CellDetail, limit = 5) {
  const members = (cell as unknown as {
    members?: Array<{ id: string; fullName: string; photoUrl: string | null }>;
  }).members;
  if (Array.isArray(members)) return members.slice(0, limit);
  return [];
}

export default function MyCellScreen() {
  const { me } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-cells-v2"],
    queryFn: () => getMyCell(),
    staleTime: 60_000,
  });

  const membersQuery = useQuery({
    queryKey: ["my-cell-members", data?.id],
    queryFn: () => (data?.id ? listCellMembers(data.id) : []),
    enabled: !!data?.id,
    staleTime: 60_000,
  });

  const attendanceMut = useMutation({
    mutationFn: async ({
      meetingId,
      presentMemberIds,
      visitorsCount,
    }: {
      meetingId: string;
      presentMemberIds: string[];
      visitorsCount: number;
    }) => postAttendance(meetingId, { presentMemberIds, visitorsCount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-cells-v2"] }),
  });

  const onRefresh = useCallback(async () => {
    await refetch();
    if (data?.id) await membersQuery.refetch();
  }, [refetch, membersQuery, data?.id]);

  const canRegisterAttendance =
    !!data?.id &&
    (hasPermission(me?.permissions ?? [], "cells:write") ||
      hasPermission(me?.permissions ?? [], "schedules:confirm"));

  const nextMeeting = (data as CellDetail & {
    nextMeeting?: { startsAt?: string; title?: string; id?: string };
  }).nextMeeting;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Minha Célula" showBack subtitle="Informações e reuniões" />
        <ScreenContainer edges={["left", "right", "bottom"]}>
          <LoadingSkeleton variant="heroCard" />
          <View style={{ height: theme.spacing.lg }} />
          <LoadingSkeleton variant="card" />
          <View style={{ height: theme.spacing.md }} />
          <LoadingSkeleton variant="card" />
          <View style={{ height: theme.spacing.md }} />
          <LoadingSkeleton variant="card" />
        </ScreenContainer>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Minha Célula" showBack subtitle="Informações e reuniões" />
        <ScreenContainer edges={["left", "right", "bottom"]}>
          <ErrorState onRetry={onRefresh} />
        </ScreenContainer>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Minha Célula" showBack subtitle="Informações e reuniões" />
        <ScreenContainer edges={["left", "right", "bottom"]}>
          <EmptyState
            tint="cells"
            title="Você ainda não tem uma célula"
            description="Entre em contato com a liderança para ser alocado em uma célula logo."
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        </ScreenContainer>
      </View>
    );
  }

  const members = membersQuery.data?.length
    ? membersQuery.data
    : firstMembers(data, 5);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Minha Célula" showBack subtitle="Informações e reuniões" />
      <ScreenContainer edges={["left", "right", "bottom"]} scrollable refreshing={isLoading || membersQuery.isFetching} onRefresh={onRefresh}>
        <AppCard variant="hero" style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cellName}>{data.name}</Text>
              {data.leaderName ? (
                <View style={styles.leaderRow}>
                  <Avatar
                    src={null}
                    name={data.leaderName}
                    size={28}
                  />
                  <Text style={styles.leaderName}>Líder: {data.leaderName}</Text>
                </View>
              ) : null}
            </View>
            <Badge variant="success" label="Ativa" />
          </View>

          <View style={styles.infoCol}>
            <View style={styles.infoRow}>
              <Clock size={16} color={theme.colors.cyan400} />
              <Text style={styles.infoText}>{formatDayHour(data)}</Text>
            </View>
            {data.address ? (
              <View style={styles.infoRow}>
                <MapPin size={16} color={theme.colors.pink400} />
                <Text style={[styles.infoText, { flex: 1 }]} numberOfLines={2}>
                  {data.address}
                </Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Users size={16} color={theme.colors.primary400} />
              <Text style={styles.infoText}>
                {countMembers(data)} membros
              </Text>
            </View>
          </View>

          <SecondaryButton
            variant="outline"
            title="ABRIR NO MAPA"
            onPress={() => openMap(data.address)}
            style={{ marginTop: theme.spacing.lg }}
            leftIcon={<MapPin size={16} color={theme.colors.foreground} />}
          />
        </AppCard>

        {canRegisterAttendance && nextMeeting?.id ? (
          <PrimaryButton
            variant="gradient"
            title="REGISTRAR PRESENÇA"
            style={{ marginTop: theme.spacing.lg }}
            leftIcon={<ClipboardList size={16} color={theme.colors.foreground} />}
            onPress={() => {
              attendanceMut.mutate({
                meetingId: nextMeeting.id!,
                presentMemberIds: members.map((m) => m.id),
                visitorsCount: 0,
              });
            }}
            loading={attendanceMut.isPending}
          />
        ) : null}

        <View style={{ height: theme.spacing.xl }} />

        <SectionHeader title="Próxima Reunião" />
        <AppCard style={styles.sectionCard}>
          {nextMeeting ? (
            <>
              <Text style={styles.meetingTitle}>
                {nextMeeting.title || "Reunião semanal"}
              </Text>
              {nextMeeting.startsAt ? (
                <View style={styles.infoRow}>
                  <CalendarOutline color={theme.colors.green400} />
                  <Text style={styles.infoText}>
                    {new Date(nextMeeting.startsAt).toLocaleString("pt-BR")}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.subtleText}>
                Estudo semanal e comunhão com a célula.
              </Text>
            </>
          ) : (
            <Text style={styles.subtleText}>
              Nenhuma reunião agendada no momento. Avisaremos quando houver.
            </Text>
          )}
        </AppCard>

        <SectionHeader title="Avisos" actionLabel="Ver todos" />
        <AppCard style={styles.sectionCard}>
          <Text style={styles.subtleText}>
            Sem avisos no momento. Qualquer novidade a liderança comunicará aqui.
          </Text>
        </AppCard>

        <SectionHeader title="Participantes" actionLabel={`${countMembers(data)} ao todo`} />
        <AppCard style={styles.sectionCard}>
          {members.length ? (
            <View style={styles.membersGrid}>
              {members.map((m) => (
                <View key={m.id} style={styles.memberItem}>
                  <Avatar src={m.photoUrl} name={m.fullName} size={52} />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.fullName}
                  </Text>
                </View>
              ))}
              {countMembers(data) > members.length ? (
                <View style={styles.memberItem}>
                  <View style={styles.moreMembers}>
                    <Text style={styles.moreCount}>+{countMembers(data) - members.length}</Text>
                  </View>
                  <Text style={styles.memberName}>mais</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.subtleText}>Lista de participantes em atualização…</Text>
          )}
        </AppCard>

        <View style={{ height: theme.spacing.xl }} />
      </ScreenContainer>
    </View>
  );
}

function CalendarOutline({ color }: { color: string }) {
  return <Clock size={16} color={color} />;
}

const styles = StyleSheet.create({
  heroCard: { padding: theme.spacing.lg },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cellName: {
    fontFamily: "Inter_700Bold",
    color: theme.colors.foreground,
    fontSize: 22,
    lineHeight: 28,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  leaderName: {
    fontFamily: "Inter_500Medium",
    color: theme.colors.foregroundMuted,
    fontSize: 13,
  },
  infoCol: { gap: 8, marginTop: theme.spacing.sm },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontFamily: "Inter_500Medium",
    color: theme.colors.foreground,
    fontSize: 14,
  },
  sectionCard: { padding: theme.spacing.lg },
  meetingTitle: {
    fontFamily: "Inter_700Bold",
    color: theme.colors.foreground,
    fontSize: 16,
    marginBottom: 6,
  },
  subtleText: {
    fontFamily: "Inter_400Regular",
    color: theme.colors.foregroundMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  membersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  memberItem: {
    width: 76,
    alignItems: "center",
    gap: 6,
  },
  memberName: {
    fontFamily: "Inter_500Medium",
    color: theme.colors.foreground,
    fontSize: 12,
    textAlign: "center",
  },
  moreMembers: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.white08,
    alignItems: "center",
    justifyContent: "center",
  },
  moreCount: {
    fontFamily: "Inter_700Bold",
    color: theme.colors.foreground,
    fontSize: 14,
  },
});
