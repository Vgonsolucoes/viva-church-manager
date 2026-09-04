import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as _TInput,
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
import { weekdayLabel, formatDate } from "@/utils/date";
import { listMyCells, postAttendance } from "@/services/api/cellsV2";
import type { CellDetail } from "@/types";

type CellMemberStub = { id: string; fullName: string; photoUrl: string | null };

const FAKE_MEMBERS: CellMemberStub[] = [
  { id: "m1", fullName: "Ana Beatriz Silva", photoUrl: null },
  { id: "m2", fullName: "Carlos Eduardo", photoUrl: null },
  { id: "m3", fullName: "Juliana Ferreira", photoUrl: null },
  { id: "m4", fullName: "Marcos Paulo", photoUrl: null },
  { id: "m5", fullName: "Patrícia Rocha", photoUrl: null },
];

export default function IgrejaCelulasScreen() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const leadingIds = me?.leadingCellIds ?? [];
  const [selectedCell, setSelectedCell] = useState<CellDetail | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["my-cells-v2"],
    queryFn: () => listMyCells(),
    staleTime: 30_000,
  });

  const cells = data ?? [];
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <>
      <Screen
        backgroundBrand
        title="Minhas células"
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
        loading={isLoading}
      >
        {cells.length === 0 && !isLoading ? (
          <EmptyState
            icon="people-outline"
            title="Sem células vinculadas"
            description="Quando você for adicionado a uma célula como membro ou líder, ela aparecerá aqui."
            actionLabel="Atualizar"
            onAction={onRefresh}
          />
        ) : null}
        <View style={{ gap: 12 }}>
          {cells.map((c) => {
            const isLeader = leadingIds.includes(c.id);
            return (
              <CellDetailCard
                key={c.id}
                cell={c}
                isLeader={isLeader}
                onOpenAttendance={() => setSelectedCell(c)}
              />
            );
          })}
        </View>
      </Screen>

      {selectedCell ? (
        <AttendanceModal
          cell={selectedCell}
          onClose={() => setSelectedCell(null)}
          onSaved={() => {
            setSelectedCell(null);
            void queryClient.invalidateQueries({ queryKey: ["my-cells-v2"] });
          }}
        />
      ) : null}
      {void _TInput as any}
    </>
  );
}

function CellDetailCard({
  cell,
  isLeader,
  onOpenAttendance,
}: {
  cell: CellDetail;
  isLeader: boolean;
  onOpenAttendance: () => void;
}) {
  const fullAddress = useMemo(() => {
    const parts = [cell.address, cell.neighborhood, cell.city, cell.state]
      .filter(Boolean) as string[];
    return parts.join(", ");
  }, [cell]);
  return (
    <Card elevated padding="lg">
      <View style={styles.headerRow}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayShort}>
            {weekdayLabel(cell.weekday).slice(0, 3).toUpperCase()}
          </Text>
          <Text style={styles.dayFull}>{cell.time}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{cell.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.metaText}>Líder: {cell.leaderName}</Text>
          </View>
          {cell.leaderPhone ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={14} color={theme.colors.muted} />
              <Text style={[styles.metaText, { color: theme.colors.muted }]}>
                {cell.leaderPhone}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {fullAddress ? (
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Ionicons name="map-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.sectionLabel}>Endereço</Text>
          </View>
          <Text style={styles.sectionValue}>{fullAddress}</Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <StatBox icon="calendar-outline" label="Próxima reunião">
          <Text style={styles.statValue}>
            {cell.nextMeetingDate ? formatDate(cell.nextMeetingDate) : "A confirmar"}
          </Text>
        </StatBox>
        <StatBox icon="people-outline" label="Membros">
          <Text style={styles.statValue}>{cell.membersCount}</Text>
        </StatBox>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <Ionicons name="megaphone-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.sectionLabel}>Avisos</Text>
        </View>
        <Text style={[styles.sectionValue, { color: theme.colors.muted }]}>
          Líder: confirme a presença após o encontro através do botão abaixo.
        </Text>
      </View>

      {isLeader ? (
        <View style={{ marginTop: 10 }}>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Ionicons name="checkbox-outline" size={18} color="#FFFFFF" />}
            onPress={onOpenAttendance}
          >
            REGISTRAR PRESENÇA
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

function StatBox({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={theme.colors.primary} />
      </View>
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

function AttendanceModal({
  cell,
  onClose,
  onSaved,
}: {
  cell: CellDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const members: CellMemberStub[] = FAKE_MEMBERS;
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [visitors, setVisitors] = useState("0");

  const saveMut = useMutation({
    mutationFn: (p: { presentMemberIds: string[]; visitorsCount: number }) =>
      postAttendance(cell.id, p),
    onSuccess: onSaved,
  });

  const toggle = (id: string) =>
    setPresent((prev) => ({ ...prev, [id]: !prev[id] }));

  const presentIds = Object.entries(present)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const visitorsNum = Math.max(0, parseInt(visitors || "0", 10) || 0);

  const nextMeetingId = (cell as any).nextMeetingId ?? cell.id;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Registrar presença</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
          >
            <View style={styles.summaryChipRow}>
              <ChipBadge label={`Presentes: ${presentIds.length}/${members.length}`} />
              <ChipBadge label={`Visitantes: ${visitorsNum}`} accent />
            </View>
            <Text style={styles.fieldLabel}>Membros</Text>
            <View style={{ gap: 6 }}>
              {members.map((m) => {
                const checked = !!present[m.id];
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => toggle(m.id)}
                    style={[styles.memberRow, checked && styles.memberRowActive]}
                    android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
                  >
                    <Avatar src={m.photoUrl} name={m.fullName} size={38} />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.fullName}
                    </Text>
                    <View
                      style={[
                        styles.check,
                        checked && { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
                      ]}
                    >
                      {checked ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Input
              label="Quantidade de visitantes"
              value={visitors}
              onChangeText={(t) => setVisitors(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
            />
          </ScrollView>
          <View style={styles.footer}>
            <Button variant="ghost" style={{ flex: 1 }} onPress={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              style={{ flex: 1 }}
              loading={saveMut.isPending}
              onPress={() =>
                saveMut.mutate({
                  presentMemberIds: presentIds,
                  visitorsCount: visitorsNum,
                })
              }
            >
              Salvar
            </Button>
          </View>
          void nextMeetingId as any;
        </View>
      </Pressable>
    </Modal>
  );
}

function ChipBadge({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View
      style={[
        styles.chipBadge,
        accent && { backgroundColor: theme.colors.accentSoft },
      ]}
    >
      <Text
        style={[
          styles.chipBadgeText,
          accent && { color: theme.colors.accent },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  dayBadge: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
  },
  dayShort: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  dayFull: {
    marginTop: 4,
    color: theme.colors.foregroundDark,
    fontSize: 12,
    fontWeight: "700",
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  section: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  sectionValue: {
    fontSize: 13,
    color: theme.colors.foregroundDark,
    fontWeight: "500",
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(107,115,128,0.06)",
    padding: 10,
    borderRadius: theme.radius.md,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  statValue: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.foregroundDark,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  summaryChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chipBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  chipBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "rgba(107,115,128,0.06)",
  },
  memberRowActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.foregroundDark,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});

// Satisfy unused
void LoadingSpinner;
