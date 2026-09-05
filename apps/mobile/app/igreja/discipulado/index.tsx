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
import { Calendar, Clock, Users, ChevronRight, CalendarDays, MessageCircle } from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Avatar } from "@/components/Avatar";
import { AppCard } from "@/components/AppCard";
import { SecondaryButton } from "@/components/SecondaryButton";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/theme";
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
      <ScreenContainer
        edges={["top", "left", "right", "bottom"]}
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
        contentStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xxxxl }}
      >
        <View style={{ paddingHorizontal: theme.spacing.xs, paddingTop: theme.spacing.sm }}>
          <Text style={styles.screenTitle}>Meu Discipulado</Text>
          <Text style={styles.screenSubtitle}>Acompanhe seu crescimento e rede</Text>
        </View>

        {isLoading && !isFetching ? (
          <View style={{ alignItems: "center", paddingVertical: theme.spacing.xxxl }}>
            <LoadingSpinner />
          </View>
        ) : (
          <>
            <AppCard variant="hero" style={styles.disciplerCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing.md }}>
                <Text style={styles.sectionLabel}>Meu Discipulador</Text>
              </View>

              {disciplerForMe ? (
                <>
                  <View style={styles.disciplerRow}>
                    <Avatar
                      name={disciplerForMe.disciplerName}
                      size="lg"
                      ringColor={theme.colors.primary400}
                      ringWidth={3}
                    />
                    <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
                      <Text style={styles.disciplerName} numberOfLines={1}>
                        {disciplerForMe.disciplerName}
                      </Text>
                      {disciplerForMe.stage ? (
                        <Text style={styles.disciplerStage}>Etapa {disciplerForMe.stage}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.datesGrid}>
                    <View style={styles.dateItem}>
                      <View style={[styles.dateIconWrap, { backgroundColor: "rgba(34,201,149,0.14)" }]}>
                        <Calendar size={16} color={theme.colors.green500} />
                      </View>
                      <View style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
                        <Text style={styles.dateLabel}>Último encontro</Text>
                        <Text style={styles.dateValue}>
                          {disciplerForMe.lastMeetingAt
                            ? formatDate(disciplerForMe.lastMeetingAt)
                            : "Ainda não houve"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dateItem}>
                      <View style={[styles.dateIconWrap, { backgroundColor: "rgba(23,107,255,0.14)" }]}>
                        <Clock size={16} color={theme.colors.primary400} />
                      </View>
                      <View style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
                        <Text style={styles.dateLabel}>Próximo encontro</Text>
                        <Text style={styles.dateValue}>
                          {disciplerForMe.nextMeetingAt
                            ? formatDate(disciplerForMe.nextMeetingAt)
                            : "A combinar"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginTop: theme.spacing.lg }}>
                    <SecondaryButton
                      title="Entrar em contato"
                      variant="outline"
                      onPress={() => {}}
                    />
                  </View>
                </>
              ) : (
                <EmptyState
                  tint="info"
                  title="Sem discipulador definido"
                  description="Entre em contato com a liderança para ser conectado a um discipulador."
                />
              )}
            </AppCard>

            <View style={{ gap: theme.spacing.sm }}>
              <AppCard
                variant="outlined"
                onPress={() => {}}
                padding={theme.spacing.lg}
              >
                <View style={styles.menuRow}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(23,107,255,0.12)" }]}>
                    <CalendarDays size={20} color={theme.colors.primary400} />
                  </View>
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <Text style={styles.menuTitle}>Meus encontros</Text>
                    <Text style={styles.menuSubtitle}>Histórico de reuniões</Text>
                  </View>
                  <ChevronRight size={20} color={theme.colors.foregroundMuted} />
                </View>
              </AppCard>

              <AppCard
                variant="outlined"
                onPress={() => router.push("/igreja/discipulado/rede")}
                padding={theme.spacing.lg}
              >
                <View style={styles.menuRow}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(112,87,255,0.14)" }]}>
                    <Users size={20} color={theme.colors.purple400} />
                  </View>
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <Text style={styles.menuTitle}>Minha rede</Text>
                    <Text style={styles.menuSubtitle}>Árvore de discipulado</Text>
                  </View>
                  <ChevronRight size={20} color={theme.colors.foregroundMuted} />
                </View>
              </AppCard>

              <AppCard
                variant="outlined"
                onPress={() => {}}
                padding={theme.spacing.lg}
              >
                <View style={styles.menuRow}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(34,201,149,0.14)" }]}>
                    <Users size={20} color={theme.colors.green500} />
                  </View>
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <Text style={styles.menuTitle}>Meus discípulos</Text>
                    <Text style={styles.menuSubtitle}>
                      {isDiscipler ? `${myDisciples.length} pessoa(s)` : "Ainda sem discípulos"}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={theme.colors.foregroundMuted} />
                </View>
              </AppCard>
            </View>

            {isDiscipler ? (
              <AppCard padding={theme.spacing.lg}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.md }}>
                  <View style={[styles.menuIcon, { backgroundColor: "rgba(34,201,149,0.14)" }]}>
                    <Users size={18} color={theme.colors.green500} />
                  </View>
                  <Text style={[styles.sectionLabel, { marginLeft: theme.spacing.sm, marginBottom: 0 }]}>
                    Meus discípulos
                  </Text>
                  <View style={[styles.countBadge, { marginLeft: "auto" }]}>
                    <Text style={styles.countBadgeText}>{myDisciples.length}</Text>
                  </View>
                </View>
                <View style={{ gap: theme.spacing.sm }}>
                  {myDisciples.map((d) => (
                    <DiscipleCard
                      key={d.id}
                      item={d}
                      onNewMeeting={() => setShowMeeting(d)}
                    />
                  ))}
                </View>
              </AppCard>
            ) : null}
          </>
        )}
      </ScreenContainer>

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
      <Avatar name={item.discipleName} size="md" />
      <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
        <Text style={styles.discipleName} numberOfLines={1}>{item.discipleName}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {item.lastMeetingAt ? (
            <View style={[styles.tagMini, { backgroundColor: "rgba(34,201,149,0.12)" }]}>
              <Calendar size={11} color={theme.colors.green500} />
              <Text style={[styles.tagMiniText, { color: theme.colors.green500 }]}>
                Último: {formatDate(item.lastMeetingAt)}
              </Text>
            </View>
          ) : (
            <View style={[styles.tagMini, { backgroundColor: "rgba(244,161,0,0.12)" }]}>
              <Clock size={11} color={theme.colors.warning500} />
              <Text style={[styles.tagMiniText, { color: theme.colors.warning500 }]}>
                Sem encontros
              </Text>
            </View>
          )}
          {item.nextMeetingAt ? (
            <View style={[styles.tagMini, { backgroundColor: "rgba(23,107,255,0.12)" }]}>
              <Clock size={11} color={theme.colors.primary400} />
              <Text style={[styles.tagMiniText, { color: theme.colors.primary400 }]}>
                Próximo: {formatDate(item.nextMeetingAt)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        style={styles.plusMiniBtn}
        onPress={onNewMeeting}
        hitSlop={8}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 20, lineHeight: 20, fontFamily: theme.fontFamilies.bold }}>+</Text>
      </Pressable>
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
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 22, fontFamily: theme.fontFamilies.bold }}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          >
            <View style={styles.discipleHighlight}>
              <Avatar name={item.discipleName} size="md" />
              <View style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
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
            <SecondaryButton
              title="Cancelar"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={onClose}
            />
            <SecondaryButton
              title={saveMut.isPending ? "Salvando..." : "Salvar encontro"}
              style={{ flex: 1, backgroundColor: theme.colors.primary500 }}
              textStyle={{ color: "#FFFFFF" }}
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
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    ...theme.typography.titleLg,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
  },
  screenSubtitle: {
    ...theme.typography.body,
    color: theme.colors.foregroundMuted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  disciplerCard: {
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    ...theme.typography.captionBold,
    color: theme.colors.primary400,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: theme.spacing.md,
  },
  disciplerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  disciplerName: {
    ...theme.typography.card,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
    fontSize: 18,
  },
  disciplerStage: {
    ...theme.typography.subtle,
    color: theme.colors.primary400,
    fontFamily: theme.fontFamilies.semibold,
    marginTop: 2,
  },
  datesGrid: {
    gap: theme.spacing.sm,
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white08,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  dateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.regular,
  },
  dateValue: {
    ...theme.typography.bodySmBold,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
    marginTop: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: {
    ...theme.typography.card,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
  },
  menuSubtitle: {
    ...theme.typography.subtle,
    color: theme.colors.foregroundMuted,
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(34,201,149,0.14)",
  },
  countBadgeText: {
    ...theme.typography.captionBold,
    color: theme.colors.green500,
    fontFamily: theme.fontFamilies.bold,
  },
  discipleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white08,
  },
  discipleName: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
  },
  tagMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  tagMiniText: {
    ...theme.typography.caption,
    fontFamily: theme.fontFamilies.semibold,
    fontSize: 11,
  },
  plusMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary500,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.white16,
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
  },
  discipleHighlight: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(23,107,255,0.12)",
  },
  discipleHighlightName: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
  },
  footer: {
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
});
