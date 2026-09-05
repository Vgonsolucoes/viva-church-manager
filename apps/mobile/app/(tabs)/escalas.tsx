import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Plus, Calendar, Clock, MapPin, Pencil, Trash2 } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import {
  formatDate,
  formatTime,
  friendlyEventDate,
} from "@/utils/date";
import {
  confirmSchedule,
  createVolunteerAvailability,
  deleteVolunteerAvailability,
  listAvailableVolunteers,
  listMySchedules,
  listVolunteerAvailability,
  refuseSchedule,
  requestSubstitution,
  updateVolunteerAvailability,
} from "@/services/api/schedules";
import type {
  ScheduleAssignment,
  ScheduleDeclineReason,
  VolunteerAvailabilityBlock,
  VolunteerAvailabilityReason,
} from "@/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppCard } from "@/components/AppCard";
import { AppHeader } from "@/components/AppHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { Badge } from "@/components/Badge";
import { StatusBadge, ScheduleStatus } from "@/components/StatusBadge";
import {
  ScheduleCard as NewScheduleCard,
  ScheduleCardData,
} from "@/components/ScheduleCard";
import { LoadingSkeleton, SkeletonCardLines } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

type TabKey = "upcoming" | "history" | "availability";

const DECLINE_REASONS: ScheduleDeclineReason[] = [
  "TRABALHO",
  "VIAGEM",
  "FAMILIAR",
  "SAUDE",
  "OUTRO",
];

const AVAILABILITY_REASONS: VolunteerAvailabilityReason[] = [
  "DISPONIVEL",
  "INDISPONIVEL",
  "VIAGEM",
  "FERIAS",
  "TRABALHO",
  "OUTRO",
];

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return { label: "Aguardando", color: theme.colors.warning };
    case "CONFIRMED":
      return { label: "Confirmado", color: theme.colors.success };
    case "DECLINED":
      return { label: "Recusado", color: theme.colors.destructive };
    case "SUBSTITUTE_REQUESTED":
      return { label: "Substituição", color: theme.colors.primary };
    default:
      return { label: status, color: theme.colors.muted };
  }
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "upcoming", label: "Próximas" },
  { key: "history", label: "Histórico" },
  { key: "availability", label: "Disponibilidade" },
];

function assignmentToCardData(s: ScheduleAssignment): ScheduleCardData {
  const startsAt = s.schedule?.startsAt;
  const endsAt = s.schedule?.endsAt;
  const dateLabel = startsAt ? friendlyEventDate(startsAt) : "Data não informada";
  const timeRangeLabel =
    startsAt && endsAt
      ? `${formatTime(startsAt)} - ${formatTime(endsAt)}`
      : startsAt
        ? formatTime(startsAt)
        : "";
  return {
    id: s.id,
    title: s.schedule?.title ?? "Escala",
    dateLabel,
    timeRangeLabel,
    ministryLabel: undefined,
    roleLabel: s.roleName,
    status: (s.status as ScheduleStatus) ?? "PENDING",
    category: "OUTRO",
    canConfirm: s.status === "PENDING",
    canRefuse: s.status === "PENDING",
  };
}

export default function EscalasScreen() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [refuseFor, setRefuseFor] = useState<ScheduleAssignment | null>(null);
  const [subFor, setSubFor] = useState<ScheduleAssignment | null>(null);
  const [editingBlock, setEditingBlock] = useState<VolunteerAvailabilityBlock | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  const {
    data: schedules,
    isLoading: schedLoading,
    isFetching: schedFetching,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ["my-schedules"],
    queryFn: () => listMySchedules(),
    staleTime: 30_000,
  });

  const {
    data: availability,
    isLoading: availLoading,
    isFetching: availFetching,
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: ["volunteer-availability"],
    queryFn: () => listVolunteerAvailability(),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchSchedules(), refetchAvailability()]);
  }, [refetchSchedules, refetchAvailability]);

  const now = Date.now();
  const schedulesArr = schedules ?? [];
  const upcoming = useMemo(
    () =>
      schedulesArr
        .filter((s) => {
          const start = new Date(s.schedule?.startsAt ?? s.confirmedAt ?? now).getTime();
          return start + 3_600_000 >= now;
        })
        .sort(
          (a, b) =>
            +new Date(a.schedule?.startsAt ?? 0) -
            +new Date(b.schedule?.startsAt ?? 0),
        ),
    [schedulesArr],
  );
  const history = useMemo(
    () =>
      schedulesArr
        .filter((s) => {
          const start = new Date(s.schedule?.startsAt ?? s.confirmedAt ?? now).getTime();
          return start + 3_600_000 < now;
        })
        .sort(
          (a, b) =>
            +new Date(b.schedule?.startsAt ?? 0) -
            +new Date(a.schedule?.startsAt ?? 0),
        ),
    [schedulesArr],
  );
  const availabilityArr = availability ?? [];

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-schedules"] });
    void queryClient.invalidateQueries({ queryKey: ["volunteer-availability"] });
  };

  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmSchedule(id),
    onSuccess: refreshAll,
  });
  const refuseMut = useMutation({
    mutationFn: (p: { id: string; reason: ScheduleDeclineReason; note?: string | null }) =>
      refuseSchedule(p.id, { reason: p.reason, note: p.note }),
    onSuccess: refreshAll,
  });
  const subMut = useMutation({
    mutationFn: (p: {
      id: string;
      toVolunteerId: string;
      reason: ScheduleDeclineReason;
      note?: string | null;
    }) => requestSubstitution(p.id, { toVolunteerId: p.toVolunteerId, reason: p.reason, note: p.note }),
    onSuccess: refreshAll,
  });
  const availCreateMut = useMutation({
    mutationFn: (p: Parameters<typeof createVolunteerAvailability>[0]) =>
      createVolunteerAvailability(p),
    onSuccess: () => {
      setShowAvailabilityModal(false);
      setEditingBlock(null);
      refreshAll();
    },
  });
  const availUpdateMut = useMutation({
    mutationFn: (p: { id: string; payload: Parameters<typeof updateVolunteerAvailability>[1] }) =>
      updateVolunteerAvailability(p.id, p.payload),
    onSuccess: () => {
      setShowAvailabilityModal(false);
      setEditingBlock(null);
      refreshAll();
    },
  });
  const availDeleteMut = useMutation({
    mutationFn: (id: string) => deleteVolunteerAvailability(id),
    onSuccess: refreshAll,
  });

  const isLoading =
    (tab === "availability" ? availLoading : schedLoading) && !schedules && !availability;
  const isFetching = schedFetching || availFetching;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Minhas Escalas" />

      <View style={styles.tabsWrap}>
        <TabsBar value={tab} onChange={setTab} />
      </View>

      <View style={{ flex: 1 }}>
        <ScreenContainer
          scrollable={true}
          padded={true}
          edges={["left", "right", "bottom"]}
          noTopPadding={true}
          refreshing={isFetching && !isLoading}
          onRefresh={onRefresh}
        >
          {tab === "upcoming" ? (
            <ScheduleListWrapper
              items={upcoming}
              isLoading={schedLoading && !schedules}
              emptyIcon="clipboard-outline"
              emptyTitle="Nenhuma escala próxima"
              emptyDesc="Você não tem escalas aguardando confirmação. Quando surgirem, elas aparecerão aqui."
              onConfirm={(s) => confirmMut.mutate(s.id)}
              onRefuse={(s) => setRefuseFor(s)}
              onSubstitute={(s) => setSubFor(s)}
              confirmingId={confirmMut.variables ?? null}
              readOnly={false}
              tint="schedules"
            />
          ) : tab === "history" ? (
            <ScheduleListWrapper
              items={history}
              isLoading={schedLoading && !schedules}
              emptyIcon="archive-outline"
              emptyTitle="Histórico vazio"
              emptyDesc="Escalas antigas aparecerão aqui após serem concluídas."
              readOnly
              tint="schedules"
            />
          ) : (
            <AvailabilityList
              items={availabilityArr}
              isLoading={availLoading && !availability}
              onEdit={(b) => {
                setEditingBlock(b);
                setShowAvailabilityModal(true);
              }}
              onDelete={(id) => availDeleteMut.mutate(id)}
            />
          )}

          <View style={{ height: 96 }} />
        </ScreenContainer>

        {tab === "availability" ? (
          <FAB
            onPress={() => {
              setEditingBlock(null);
              setShowAvailabilityModal(true);
            }}
          />
        ) : null}
      </View>

      {refuseFor ? (
        <BottomSheetModal visible onClose={() => setRefuseFor(null)} title="Motivo da recusa">
          <RefuseForm
            initialNote=""
            submitting={refuseMut.isPending}
            onCancel={() => setRefuseFor(null)}
            onSubmit={(reason, note) => {
              refuseMut.mutate({ id: refuseFor.id, reason, note });
              setRefuseFor(null);
            }}
          />
        </BottomSheetModal>
      ) : null}

      {subFor ? (
        <BottomSheetModal
          visible
          onClose={() => setSubFor(null)}
          title="Solicitar substituição"
        >
          <SubstitutionForm
            assignmentId={subFor.id}
            submitting={subMut.isPending}
            onCancel={() => setSubFor(null)}
            onSubmit={(toVolunteerId, reason, note) => {
              subMut.mutate({ id: subFor.id, toVolunteerId, reason, note });
              setSubFor(null);
            }}
          />
        </BottomSheetModal>
      ) : null}

      {showAvailabilityModal ? (
        <BottomSheetModal
          visible
          onClose={() => {
            setShowAvailabilityModal(false);
            setEditingBlock(null);
          }}
          title={editingBlock ? "Editar disponibilidade" : "Adicionar disponibilidade"}
        >
          <AvailabilityForm
            block={editingBlock}
            submitting={availCreateMut.isPending || availUpdateMut.isPending}
            onCancel={() => {
              setShowAvailabilityModal(false);
              setEditingBlock(null);
            }}
            onSubmit={(payload) => {
              if (editingBlock) {
                availUpdateMut.mutate({ id: editingBlock.id, payload });
              } else {
                availCreateMut.mutate(payload as any);
              }
            }}
          />
        </BottomSheetModal>
      ) : null}
    </View>
  );
}

function TabsBar({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
}) {
  return (
    <View style={styles.segRoot}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map((t) => {
          const active = t.key === value;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              style={({ pressed }) => [
                styles.segBtn,
                active && styles.segBtnActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ScheduleListWrapper({
  items,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptyDesc,
  onConfirm,
  onRefuse,
  onSubstitute,
  confirmingId,
  readOnly,
  tint,
}: {
  items: ScheduleAssignment[];
  isLoading: boolean;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  emptyTitle: string;
  emptyDesc?: string;
  onConfirm?: (s: ScheduleAssignment) => void;
  onRefuse?: (s: ScheduleAssignment) => void;
  onSubstitute?: (s: ScheduleAssignment) => void;
  confirmingId?: string | null;
  readOnly: boolean;
  tint: "default" | "info" | "agenda" | "cells" | "schedules";
}) {
  if (isLoading) {
    return (
      <View style={{ gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingSkeleton key={i} variant="card" height={160} />
        ))}
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDesc}
        tint={tint}
      />
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {items.map((s) => (
        <CompatScheduleCard
          key={s.id}
          item={s}
          readOnly={readOnly}
          confirming={confirmingId === s.id}
          onConfirm={onConfirm}
          onRefuse={onRefuse}
          onSubstitute={onSubstitute}
        />
      ))}
    </View>
  );
}

function CompatScheduleCard({
  item,
  readOnly,
  confirming,
  onConfirm,
  onRefuse,
  onSubstitute,
}: {
  item: ScheduleAssignment;
  readOnly: boolean;
  confirming?: boolean;
  onConfirm?: (s: ScheduleAssignment) => void;
  onRefuse?: (s: ScheduleAssignment) => void;
  onSubstitute?: (s: ScheduleAssignment) => void;
}) {
  const st = statusLabel(item.status);
  const cardData = assignmentToCardData(item);

  return (
    <AppCard variant="default">
      <View style={{ gap: 12 }}>
        <View style={styles.cardHeaderCompat}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.cardTitleCompat}>
              {item.schedule?.title ?? "Escala"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 }}>
              <Badge label={item.roleName} variant="muted" />
              {item.schedule?.startsAt ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Calendar size={12} color={theme.colors.primary400} />
                  <Text style={styles.cardMetaCompat}>
                    {"  "}
                    {friendlyEventDate(item.schedule.startsAt)}
                  </Text>
                </View>
              ) : null}
            </View>
            {item.schedule?.startsAt ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                <Clock size={12} color={theme.colors.foregroundMuted} />
                <Text style={styles.cardMetaSubtle}>
                  {"  "}
                  {formatTime(item.schedule.startsAt)}
                  {item.schedule.endsAt ? ` - ${formatTime(item.schedule.endsAt)}` : ""}
                </Text>
              </View>
            ) : null}
            {item.schedule?.location ? (
              <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 4 }}>
                <MapPin size={12} color={theme.colors.foregroundMuted} style={{ marginTop: 2 }} />
                <Text style={[styles.cardMetaSubtle, { flex: 1 }]} numberOfLines={2}>
                  {"  "}
                  {item.schedule.location}
                </Text>
              </View>
            ) : null}
          </View>
          <View>
            <StatusBadge status={item.status as ScheduleStatus} />
          </View>
        </View>

        {!readOnly && item.status === "PENDING" ? (
          <View style={styles.actionsRowCompat}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <PrimaryButton
                title="Confirmar"
                variant="solid"
                loading={confirming}
                onPress={() => onConfirm?.(item)}
                height={44}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                title="Recusar"
                variant="default"
                height={44}
                onPress={() => onRefuse?.(item)}
                textStyle={{ color: theme.colors.danger500 }}
              />
            </View>
          </View>
        ) : null}

        {!readOnly && item.status === "PENDING" ? (
          <View style={{ marginTop: 0 }}>
            <SecondaryButton
              title="Solicitar substituição"
              variant="outline"
              height={42}
              onPress={() => onSubstitute?.(item)}
            />
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

function AvailabilityList({
  items,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: VolunteerAvailabilityBlock[];
  isLoading: boolean;
  onAdd?: () => void;
  onEdit: (b: VolunteerAvailabilityBlock) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...items].sort(
    (a, b) => +new Date(a.startDate) - +new Date(b.startDate),
  );

  if (isLoading) {
    return (
      <View style={{ gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingSkeleton key={i} variant="card" height={130} />
        ))}
      </View>
    );
  }

  return (
    <View>
      {items.length === 0 ? (
        <EmptyState
          title="Sem bloqueios de disponibilidade"
          description="Adicione períodos de disponibilidade ou indisponibilidade para a equipe de escalas usando o botão + abaixo."
          tint="schedules"
        />
      ) : (
        <View style={{ gap: 12 }}>
          {sorted.map((b) => (
            <AvailabilityCard key={b.id} block={b} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </View>
      )}
    </View>
  );
}

function AvailabilityCard({
  block,
  onEdit,
  onDelete,
}: {
  block: VolunteerAvailabilityBlock;
  onEdit: (b: VolunteerAvailabilityBlock) => void;
  onDelete: (id: string) => void;
}) {
  const colorByReason: Record<string, string> = {
    DISPONIVEL: theme.colors.green500,
    INDISPONIVEL: theme.colors.danger500,
    VIAGEM: theme.colors.warning500,
    FERIAS: theme.colors.primary500,
    TRABALHO: theme.colors.purple500,
    OUTRO: theme.colors.foregroundMuted,
  };
  const color = colorByReason[block.reason] ?? theme.colors.foregroundMuted;
  const variantByColor: Record<string, any> = {
    [theme.colors.green500]: "success",
    [theme.colors.danger500]: "danger",
    [theme.colors.warning500]: "warning",
    [theme.colors.primary500]: "primary",
    [theme.colors.purple500]: "purple",
  };
  const badgeVariant = variantByColor[color] ?? "muted";

  return (
    <AppCard variant="default">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Badge label={block.reason} variant={badgeVariant} />
          <Text style={[styles.availDates, { color: "#FFFFFF" }]}>
            {formatDate(block.startDate)}
            {block.endDate ? ` até ${formatDate(block.endDate)}` : ""}
          </Text>
          {block.note ? (
            <Text style={styles.availNote} numberOfLines={3}>
              {block.note}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            style={styles.iconButton}
            onPress={() => onEdit(block)}
            hitSlop={8}
          >
            <Pencil size={16} color={theme.colors.primary400} />
          </Pressable>
          <Pressable
            style={[styles.iconButton, { backgroundColor: "rgba(240,68,56,0.10)" }]}
            onPress={() => onDelete(block.id)}
            hitSlop={8}
          >
            <Trash2 size={16} color={theme.colors.danger500} />
          </Pressable>
        </View>
      </View>
    </AppCard>
  );
}

function FAB({ onPress }: { onPress: () => void }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        zIndex: 50,
        ...(Platform.OS === "android"
          ? {
              elevation: 8,
            }
          : {
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
            }),
      }}
    >
      <PrimaryButton
        variant="small"
        title=""
        style={{ width: 56, height: 56, paddingHorizontal: 0 }}
        onPress={onPress}
        leftIcon={<Plus size={22} color="#FFFFFF" />}
      />
    </View>
  );
}

function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.colors.foregroundMuted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 12 }}
          >
            {children}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function RefuseForm({
  initialNote,
  submitting,
  onCancel,
  onSubmit,
}: {
  initialNote?: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (reason: ScheduleDeclineReason, note: string) => void;
}) {
  const [reason, setReason] = useState<ScheduleDeclineReason>(DECLINE_REASONS[0]);
  const [note, setNote] = useState(initialNote ?? "");
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.fieldLabel}>Motivo</Text>
      <View style={styles.chipGroup}>
        {DECLINE_REASONS.map((r) => {
          const active = reason === r;
          return (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="Observações (opcional)"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
        style={{ minHeight: 80, textAlignVertical: "top" }}
        placeholder="Adicione detalhes se necessário..."
      />
      <View style={styles.modalFooter}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <SecondaryButton title="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            title="Confirmar recusa"
            variant="solid"
            loading={submitting}
            onPress={() => onSubmit(reason, note)}
          />
        </View>
      </View>
    </View>
  );
}

function SubstitutionForm({
  assignmentId,
  submitting,
  onCancel,
  onSubmit,
}: {
  assignmentId: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (toVolunteerId: string, reason: ScheduleDeclineReason, note: string) => void;
}) {
  const [reason, setReason] = useState<ScheduleDeclineReason>(DECLINE_REASONS[0]);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data: vols, isLoading } = useQuery({
    queryKey: ["available-volunteers", assignmentId],
    queryFn: () => listAvailableVolunteers(assignmentId),
    staleTime: 60_000,
  });
  const volsArr = vols ?? [];
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.fieldLabel}>Voluntário disponível</Text>
      {isLoading ? (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <LoadingSpinner />
        </View>
      ) : volsArr.length === 0 ? (
        <EmptyState
          title="Nenhum voluntário listado"
          description="Verifique com a liderança a lista de voluntários ativos."
          tint="schedules"
        />
      ) : (
        <View style={styles.volList}>
          {volsArr.map((v: { id: string; fullName: string; photoUrl: string | null }) => {
            const active = selected === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setSelected(v.id)}
                style={({ pressed }) => [
                  styles.volRow,
                  active && styles.volRowActive,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Avatar src={v.photoUrl} name={v.fullName} size="md" />
                <Text style={styles.volName} numberOfLines={1}>
                  {v.fullName}
                </Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary500} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={styles.fieldLabel}>Motivo</Text>
      <View style={styles.chipGroup}>
        {DECLINE_REASONS.map((r) => {
          const active = reason === r;
          return (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="Observações (opcional)"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
        style={{ minHeight: 80, textAlignVertical: "top" }}
      />
      <View style={styles.modalFooter}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <SecondaryButton title="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            title="Solicitar"
            variant="solid"
            loading={submitting}
            disabled={!selected}
            onPress={() => selected && onSubmit(selected, reason, note)}
          />
        </View>
      </View>
    </View>
  );
}

function AvailabilityForm({
  block,
  submitting,
  onCancel,
  onSubmit,
}: {
  block: VolunteerAvailabilityBlock | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (p: {
    startDate: Date | string;
    endDate?: Date | string | null;
    reason: string;
    note?: string | null;
  }) => void;
}) {
  const [startStr, setStartStr] = useState(() =>
    block?.startDate ? formatDate(block.startDate) : formatDate(new Date()),
  );
  const [endStr, setEndStr] = useState(() =>
    block?.endDate ? formatDate(block.endDate) : "",
  );
  const [reason, setReason] = useState<VolunteerAvailabilityReason>(
    (block?.reason as VolunteerAvailabilityReason) ?? AVAILABILITY_REASONS[0],
  );
  const [note, setNote] = useState(block?.note ?? "");

  const toISO = (s: string) => {
    const parts = s.split("/");
    if (parts.length !== 3) return new Date().toISOString();
    const [d, m, y] = parts;
    return new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.fieldLabel}>Razão</Text>
      <View style={styles.chipGroup}>
        {AVAILABILITY_REASONS.map((r) => {
          const active = reason === r;
          return (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="Data início (DD/MM/AAAA)"
        value={startStr}
        onChangeText={setStartStr}
        placeholder="01/01/2026"
        keyboardType="numbers-and-punctuation"
      />
      <Input
        label="Data fim (opcional, DD/MM/AAAA)"
        value={endStr}
        onChangeText={setEndStr}
        placeholder="05/01/2026"
        keyboardType="numbers-and-punctuation"
      />
      <Input
        label="Observações (opcional)"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
        style={{ minHeight: 80, textAlignVertical: "top" }}
      />
      <View style={styles.modalFooter}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <SecondaryButton title="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            title={block ? "Salvar alterações" : "Criar bloqueio"}
            variant="solid"
            loading={submitting}
            onPress={() =>
              onSubmit({
                startDate: toISO(startStr),
                endDate: endStr ? toISO(endStr) : null,
                reason,
                note: note || null,
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  segRoot: { width: "100%" },
  segBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white08,
    borderWidth: 1,
    borderColor: theme.colors.white16,
  },
  segBtnActive: {
    backgroundColor: theme.colors.primary500,
    borderColor: theme.colors.primary500,
  },
  segText: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 13,
  },
  segTextActive: { color: "#FFFFFF" },

  cardHeaderCompat: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitleCompat: {
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  cardMetaCompat: {
    color: theme.colors.primary400,
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 12,
  },
  cardMetaSubtle: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
    fontSize: 12,
  },
  actionsRowCompat: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  availDates: {
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 14,
    marginTop: 8,
  },
  availNote: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23,107,255,0.10)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark ?? "rgba(6,16,29,0.72)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.colors.backgroundSecondary ?? "#081729",
    borderTopLeftRadius: theme.radius.xl ?? 24,
    borderTopRightRadius: theme.radius.xl ?? 24,
    maxHeight: "85%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.white16,
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    fontSize: 17,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  fieldLabel: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.white16,
    backgroundColor: theme.colors.white08,
  },
  chipActive: {
    backgroundColor: theme.colors.primary500,
    borderColor: theme.colors.primary500,
  },
  chipText: {
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
    fontSize: 12,
  },
  chipTextActive: { color: "#FFFFFF" },
  volList: {
    gap: 6,
    maxHeight: 260,
  },
  volRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: theme.colors.white08,
  },
  volRowActive: {
    backgroundColor: "rgba(23,107,255,0.14)",
    borderColor: theme.colors.primary500,
  },
  volName: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 14,
  },
});

// Satisfy unused imports (TextInput used in other places might be optional)
void (TextInput as any);
void (formatTime as any);
void Screen;
void Card;
void Button;
void LoadingSpinner;
void NewScheduleCard;
void SkeletonCardLines;
void ErrorState;
