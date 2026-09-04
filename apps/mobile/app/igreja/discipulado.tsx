import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/utils/date";
import {
  createDiscipleshipMeeting,
  listMyDiscipleships,
} from "@/services/api/discipleship";
import type { Discipleship } from "@/types";

export default function IgrejaDiscipuladoScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [showMeeting, setShowMeeting] = useState<Discipleship | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["my-discipleships"],
    queryFn: () => listMyDiscipleships(),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const discArr = (data ?? []) as Discipleship[];
  const myId = me?.id ?? me?.member?.id ?? "";

  const disciplerForMe = discArr.find(
    (d: Discipleship) => d.discipleId === myId || d.discipleName === me?.name,
  );
  const myDisciples = discArr.filter(
    (d: Discipleship) => d.disciplerId === myId || d.disciplerName === me?.name,
  );
  const isDiscipler = myDisciples.length > 0;

  return (
    <>
      <Screen
        backgroundBrand
        title="Discipulado"
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
        loading={isLoading}
      >
        <View style={{ gap: 14 }}>
          <Card elevated padding="lg">
            <View style={styles.cardHeader}>
              <Ionicons
                name="school-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.cardHeaderTitle}>Meu discipulador</Text>
            </View>
            {disciplerForMe ? (
              <View>
                <View style={styles.personRow}>
                  <Avatar name={disciplerForMe.disciplerName} size={48} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.personName}>
                      {disciplerForMe.disciplerName}
                    </Text>
                    {disciplerForMe.stage ? (
                      <Text style={styles.personSub}>
                        Etapa: {disciplerForMe.stage}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.datesRow}>
                  <InfoMini
                    icon="calendar-outline"
                    label="Último encontro"
                    value={
                      disciplerForMe.lastMeetingAt
                        ? formatDate(disciplerForMe.lastMeetingAt)
                        : "Ainda não houve"
                    }
                  />
                  <InfoMini
                    icon="alarm-outline"
                    label="Próximo encontro"
                    value={
                      disciplerForMe.nextMeetingAt
                        ? formatDate(disciplerForMe.nextMeetingAt)
                        : "A combinar"
                    }
                  />
                </View>
              </View>
            ) : (
              <EmptyState
                icon="person-remove-outline"
                title="Sem discipulador definido"
                description="Entre em contato com a liderança para ser conectado a um discipulador."
              />
            )}
          </Card>

          {isDiscipler ? (
            <Card elevated padding="lg">
              <View style={styles.cardHeader}>
                <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.cardHeaderTitle}>Meus discípulos</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{myDisciples.length}</Text>
                </View>
              </View>
              <View style={{ gap: 10 }}>
                {myDisciples.map((d) => (
                  <DiscipleCard
                    key={d.id}
                    item={d}
                    onNewMeeting={() => setShowMeeting(d)}
                  />
                ))}
              </View>
              <View style={{ marginTop: 12 }}>
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={
                    <Ionicons
                      name="git-network-outline"
                      size={18}
                      color={theme.colors.foregroundDark}
                    />
                  }
                  onPress={() => router.push("/igreja/discipulado/rede")}
                >
                  VER REDE
                </Button>
              </View>
            </Card>
          ) : (
            <Card elevated padding="lg">
              <View style={styles.cardHeader}>
                <Ionicons
                  name="git-network-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.cardHeaderTitle}>Rede de discipulado</Text>
              </View>
              <Text style={styles.mutedBlock}>
                Acompanhe a árvore de discipulado da sua célula ou ministério. O botão abaixo
                abrirá a rede completa.
              </Text>
              <View style={{ marginTop: 10 }}>
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={
                    <Ionicons
                      name="share-outline"
                      size={18}
                      color={theme.colors.foregroundDark}
                    />
                  }
                  onPress={() => router.push("/igreja/discipulado/rede")}
                >
                  VER REDE
                </Button>
              </View>
            </Card>
          )}
        </View>
      </Screen>

      {showMeeting ? (
        <MeetingModal
          item={showMeeting}
          onClose={() => setShowMeeting(null)}
          onSaved={() => {
            setShowMeeting(null);
            void queryClient.invalidateQueries({ queryKey: ["my-discipleships"] });
          }}
        />
      ) : null}
    </>
  );
}

function DiscipleCard({
  item,
  onNewMeeting,
}: {
  item: Discipleship;
  onNewMeeting: () => void;
}) {
  return (
    <View style={styles.discipleCard}>
      <Avatar name={item.discipleName} size={44} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={styles.discipleName}>{item.discipleName}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {item.lastMeetingAt ? (
            <TagMini
              icon="calendar-outline"
              label={`Último: ${formatDate(item.lastMeetingAt)}`}
            />
          ) : (
            <TagMini icon="warning-outline" label="Sem encontros" />
          )}
          {item.nextMeetingAt ? (
            <TagMini
              icon="alarm-outline"
              label={`Próximo: ${formatDate(item.nextMeetingAt)}`}
              accent
            />
          ) : null}
        </View>
      </View>
      <Pressable
        style={styles.plusMiniBtn}
        onPress={onNewMeeting}
        android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
      >
        <Ionicons name="add" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function TagMini({
  icon,
  label,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.tagMini,
        accent && { backgroundColor: theme.colors.accentSoft },
      ]}
    >
      <Ionicons
        name={icon}
        size={12}
        color={accent ? theme.colors.accent : theme.colors.primary}
      />
      <Text
        style={[
          styles.tagMiniText,
          accent && { color: theme.colors.accent },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function InfoMini({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoMini}>
      <Ionicons name={icon} size={14} color={theme.colors.primary} />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={styles.infoMiniLabel}>{label}</Text>
        <Text style={styles.infoMiniValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MeetingModal({
  item,
  onClose,
  onSaved,
}: {
  item: Discipleship;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dateStr, setDateStr] = useState(formatDate(new Date()));
  const [themeTxt, setThemeTxt] = useState("");
  const [notes, setNotes] = useState("");
  const [nextTheme, setNextTheme] = useState("");
  const [nextDateStr, setNextDateStr] = useState("");
  const [status, setStatus] = useState("REALIZADO");

  const toISO = (s: string) => {
    const parts = s.split("/");
    if (parts.length !== 3) return new Date().toISOString();
    const [d, m, y] = parts;
    return new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
  };

  const saveMut = useMutation({
    mutationFn: (p: Parameters<typeof createDiscipleshipMeeting>[0]) =>
      createDiscipleshipMeeting(p),
    onSuccess: onSaved,
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Registrar encontro</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
          >
            <View style={styles.discipleHighlight}>
              <Avatar name={item.discipleName} size={40} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.discipleHighlightName}>
                  Discípulo: {item.discipleName}
                </Text>
              </View>
            </View>
            <Input
              label="Data do encontro (DD/MM/AAAA)"
              value={dateStr}
              onChangeText={setDateStr}
              keyboardType="numbers-and-punctuation"
              placeholder="01/01/2026"
            />
            <Input
              label="Tema / assunto"
              value={themeTxt}
              onChangeText={setThemeTxt}
              placeholder="Ex: Oração e Palavra"
            />
            <Input
              label="Observações (opcional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
              placeholder="Pontos importantes, versículos, etc."
            />
            <Input
              label="Próximo tema (opcional)"
              value={nextTheme}
              onChangeText={setNextTheme}
              placeholder="Ex: Família e fé"
            />
            <Input
              label="Próxima data (opcional, DD/MM/AAAA)"
              value={nextDateStr}
              onChangeText={setNextDateStr}
              keyboardType="numbers-and-punctuation"
              placeholder="08/01/2026"
            />
            <Input
              label="Status"
              value={status}
              onChangeText={setStatus}
              placeholder="REALIZADO / ADIADO / AUSENTE"
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
                  discipleshipId: item.id,
                  date: toISO(dateStr),
                  theme: themeTxt || null,
                  notes: notes || null,
                  nextTheme: nextTheme || null,
                  nextDate: nextDateStr ? toISO(nextDateStr) : null,
                  status: status || null,
                })
              }
            >
              Salvar encontro
            </Button>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
    letterSpacing: 0.3,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  personName: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  personSub: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  datesRow: {
    flexDirection: "row",
    gap: 8,
  },
  infoMini: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(107,115,128,0.06)",
    padding: 10,
    borderRadius: theme.radius.md,
  },
  infoMiniLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  infoMiniValue: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.foregroundDark,
    fontWeight: "700",
  },
  mutedBlock: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 19,
  },
  discipleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(107,115,128,0.05)",
  },
  discipleName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  plusMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tagMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  tagMiniText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
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
  discipleHighlight: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
  },
  discipleHighlightName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
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
