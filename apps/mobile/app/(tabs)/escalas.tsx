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
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "upcoming", label: "Próximas", icon: "time-outline" },
  { key: "history", label: "Histórico", icon: "calendar-outline" },
  { key: "availability", label: "Disponibilidade", icon: "checkmark-done-outline" },
];

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
    <Screen
      backgroundBrand
      padded={false}
      loading={isLoading}
      loadingLabel="Carregando escalas..."
      refreshing={isFetching && !isLoading}
      onRefresh={onRefresh}
    >
      <View style={styles.tabsWrap}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
              android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={active ? "#FFFFFF" : theme.colors.muted}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ padding: 16 }}>
        {tab === "upcoming" ? (
          <ScheduleList
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
          />
        ) : tab === "history" ? (
          <ScheduleList
            items={history}
            isLoading={schedLoading && !schedules}
            emptyIcon="archive-outline"
            emptyTitle="Histórico vazio"
            emptyDesc="Escalas antigas aparecerão aqui após serem concluídas."
            readOnly
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
            onAdd={() => {
              setEditingBlock(null);
              setShowAvailabilityModal(true);
            }}
          />
        )}
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
    </Screen>
  );
}

function ScheduleList({
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
}) {
  if (isLoading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <LoadingSpinner />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} />
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {items.map((s) => (
        <ScheduleCard
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

function ScheduleCard({
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
  const dateStr = item.schedule?.startsAt
    ? friendlyEventDate(item.schedule.startsAt)
    : "Data não informada";
  return (
    <Card elevated padding="lg">
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.schedule?.title ?? "Escala"}
          </Text>
          <Text style={styles.cardRole}>{item.roleName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${st.color}22` }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Ionicons name="calendar-outline" size={14} color={theme.colors.primary} />
        <Text style={styles.cardMetaText}>{dateStr}</Text>
      </View>
      {item.schedule?.location ? (
        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
          <Text style={[styles.cardMetaText, { color: theme.colors.muted }]} numberOfLines={2}>
            {item.schedule.location}
          </Text>
        </View>
      ) : null}
      {!readOnly && item.status === "PENDING" ? (
        <View style={styles.actionsRow}>
          <Button
            size="sm"
            variant="primary"
            style={{ flex: 1 }}
            loading={confirming}
            onPress={() => onConfirm?.(item)}
            leftIcon={<Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          >
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            style={{ flex: 1 }}
            onPress={() => onRefuse?.(item)}
            leftIcon={<Ionicons name="close" size={16} color="#FFFFFF" />}
          >
            Recusar
          </Button>
          <Button
            size="sm"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => onSubstitute?.(item)}
            leftIcon={<Ionicons name="people-outline" size={16} color={theme.colors.foregroundDark} />}
          >
            Substituir
          </Button>
        </View>
      ) : null}
    </Card>
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
  onAdd: () => void;
  onEdit: (b: VolunteerAvailabilityBlock) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...items].sort(
    (a, b) => +new Date(a.startDate) - +new Date(b.startDate),
  );
  return (
    <View>
      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <LoadingSpinner />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="calendar-clear-outline"
          title="Sem bloqueios de disponibilidade"
          description="Adicione períodos de disponibilidade ou indisponibilidade para a equipe de escalas."
          actionLabel="Adicionar"
          onAction={onAdd}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {sorted.map((b) => (
            <AvailabilityCard key={b.id} block={b} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </View>
      )}
      <FAB onPress={onAdd} />
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
    DISPONIVEL: theme.colors.success,
    INDISPONIVEL: theme.colors.destructive,
    VIAGEM: theme.colors.warning,
    FERIAS: theme.colors.primary,
    TRABALHO: theme.colors.secondary,
    OUTRO: theme.colors.muted,
  };
  const color = colorByReason[block.reason] ?? theme.colors.muted;
  return (
    <Card elevated padding="lg">
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={[styles.availabilityDot, { backgroundColor: color }]} />
          <Text style={[styles.availabilityReason, { color }]}>{block.reason}</Text>
          <Text style={styles.availabilityDates}>
            {formatDate(block.startDate)}
            {block.endDate ? ` até ${formatDate(block.endDate)}` : ""}
          </Text>
          {block.note ? (
            <Text style={styles.availabilityNote} numberOfLines={3}>
              {block.note}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => onEdit(block)}
            android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
          >
            <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={() => onDelete(block.id)}
            android_ripple={{ color: theme.colors.destructiveSoft, borderless: true }}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.destructive} />
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

function FAB({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.fab}
      android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
    >
      <Ionicons name="add" size={26} color="#FFFFFF" />
    </Pressable>
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
              <Ionicons name="close" size={22} color={theme.colors.muted} />
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
              style={[styles.chip, active && styles.chipActive]}
              android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
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
        <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          size="md"
          style={{ flex: 1 }}
          loading={submitting}
          onPress={() => onSubmit(reason, note)}
        >
          Confirmar recusa
        </Button>
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
          icon="people-outline"
          title="Nenhum voluntário listado"
          description="Verifique com a liderança a lista de voluntários ativos."
        />
      ) : (
        <View style={styles.volList}>
          {volsArr.map((v: { id: string; fullName: string; photoUrl: string | null }) => {
            const active = selected === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setSelected(v.id)}
                style={[styles.volRow, active && styles.volRowActive]}
                android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
              >
                <Avatar src={v.photoUrl} name={v.fullName} size={36} />
                <Text style={styles.volName} numberOfLines={1}>
                  {v.fullName}
                </Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
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
              style={[styles.chip, active && styles.chipActive]}
              android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
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
        <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="md"
          style={{ flex: 1 }}
          loading={submitting}
          disabled={!selected}
          onPress={() => selected && onSubmit(selected, reason, note)}
        >
          Solicitar
        </Button>
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
              style={[styles.chip, active && styles.chipActive]}
              android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
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
        <Button variant="ghost" size="md" style={{ flex: 1 }} onPress={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="md"
          style={{ flex: 1 }}
          loading={submitting}
          onPress={() =>
            onSubmit({
              startDate: toISO(startStr),
              endDate: endStr ? toISO(endStr) : null,
              reason,
              note: note || null,
            })
          }
        >
          {block ? "Salvar alterações" : "Criar bloqueio"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsWrap: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  cardRole: {
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  cardMetaText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.foregroundDark,
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  availabilityReason: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  availabilityDot: {
    position: "absolute",
    left: -14,
    top: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityDates: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.foregroundDark,
    fontWeight: "600",
    left: 14,
  },
  availabilityNote: {
    left: 14,
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.muted,
  },
  cardActions: {
    flexDirection: "row",
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "85%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
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
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
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
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
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
    backgroundColor: "rgba(107,115,128,0.06)",
  },
  volRowActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  volName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.foregroundDark,
  },
});

// Satisfy unused imports (TextInput used in other places might be optional)
void (TextInput as any);
void (formatTime as any);
