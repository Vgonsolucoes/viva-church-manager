import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  Text,
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
import { createPrayerRequest, listPrayerRequests } from "@/services/api/prayer";
import { formatDate } from "@/utils/date";
import type { PrayerRequest, PrayerRequestPrivacy } from "@/types";

const PRIVACY_OPTS: PrayerRequestPrivacy[] = [
  "PRIVADO",
  "PASTORES",
  "LIDERANCA",
  "PUBLICO",
];

const PRIVACY_LABEL: Record<PrayerRequestPrivacy, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  PRIVADO: { label: "Privado", icon: "lock-closed-outline", color: theme.colors.muted },
  PASTORES: { label: "Pastores", icon: "ribbon-outline", color: theme.colors.warning },
  LIDERANCA: { label: "Liderança", icon: "people-circle-outline", color: theme.colors.primary },
  PUBLICO: { label: "Público", icon: "earth-outline", color: theme.colors.success },
};

export default function IgrejaOracaoScreen() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["prayer-requests"],
    queryFn: () => listPrayerRequests(),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const items = data ?? [];
  const sorted = [...items].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );

  const toggleLike = (id: string) =>
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const share = async (pr: PrayerRequest) => {
    try {
      await RNShare.share({
        message: `${pr.title}\n\n${pr.message}`,
      });
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Screen
        backgroundBrand
        title="Pedidos de oração"
        refreshing={isFetching && !isLoading}
        onRefresh={onRefresh}
        loading={isLoading}
        padded={false}
        scrollable={false}
      >
        <View style={{ flex: 1, padding: 16 }}>
          {isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <LoadingSpinner />
            </View>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="Sem pedidos de oração"
              description="Compartilhe um pedido ou veja aqui os pedidos compartilhados com você."
              actionLabel="Criar pedido"
              onAction={() => setShowNew(true)}
            />
          ) : (
            <ScrollView
              contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            >
              {sorted.map((pr) => {
                const pv = PRIVACY_LABEL[pr.privacy];
                const liked = likedIds.has(pr.id);
                return (
                  <Card key={pr.id} elevated padding="lg">
                    <View style={styles.headerRow}>
                      <Avatar
                        src={pr.member?.photoUrl ?? null}
                        name={pr.member?.fullName ?? "Anônimo"}
                        size={40}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.authorName}>
                          {pr.member?.fullName ?? "Anônimo"}
                        </Text>
                        <View style={styles.headerMetaRow}>
                          <View style={[styles.privacyChip, { backgroundColor: `${pv.color}22` }]}>
                            <Ionicons name={pv.icon} size={12} color={pv.color} />
                            <Text style={[styles.privacyText, { color: pv.color }]}>
                              {pv.label}
                            </Text>
                          </View>
                          <Text style={styles.dateText}>
                            {formatDate(pr.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.title}>{pr.title}</Text>
                    <Text style={styles.message}>{pr.message}</Text>
                    {pr.category ? (
                      <View style={styles.categoryChip}>
                        <Ionicons name="pricetag-outline" size={12} color={theme.colors.primary} />
                        <Text style={styles.categoryText}>{pr.category}</Text>
                      </View>
                    ) : null}
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => toggleLike(pr.id)}
                        android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
                      >
                        <Ionicons
                          name={liked ? "heart" : "heart-outline"}
                          size={18}
                          color={liked ? theme.colors.accent : theme.colors.muted}
                        />
                        <Text
                          style={[
                            styles.actionText,
                            liked && { color: theme.colors.accent },
                          ]}
                        >
                          Apoiar
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => share(pr)}
                        android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
                      >
                        <Ionicons name="share-social-outline" size={18} color={theme.colors.muted} />
                        <Text style={styles.actionText}>Compartilhar</Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </ScrollView>
          )}
        </View>
        <Pressable
          style={styles.fab}
          onPress={() => setShowNew(true)}
          android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </Pressable>
      </Screen>

      {showNew ? (
        <NewRequestModal
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            void queryClient.invalidateQueries({ queryKey: ["prayer-requests"] });
          }}
        />
      ) : null}
    </>
  );
}

function NewRequestModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [privacy, setPrivacy] = useState<PrayerRequestPrivacy>("PUBLICO");

  const saveMut = useMutation({
    mutationFn: (p: Parameters<typeof createPrayerRequest>[0]) =>
      createPrayerRequest(p),
    onSuccess: onSaved,
  });

  const canSave = title.trim().length > 0 && message.trim().length > 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Novo pedido de oração</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <Input
              label="Título"
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Saúde do meu pai"
            />
            <Input
              label="Mensagem"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              style={{ minHeight: 120, textAlignVertical: "top" }}
              placeholder="Descreva o pedido de oração com detalhes..."
            />
            <Input
              label="Categoria (opcional)"
              value={category}
              onChangeText={setCategory}
              placeholder="Ex: Família, Saúde, Finanças"
            />
            <Text style={styles.fieldLabel}>Privacidade</Text>
            <View style={styles.privacyGrid}>
              {PRIVACY_OPTS.map((p) => {
                const meta = PRIVACY_LABEL[p];
                const active = privacy === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPrivacy(p)}
                    style={[
                      styles.privacyCard,
                      active && {
                        backgroundColor: `${meta.color}18`,
                        borderColor: meta.color,
                      },
                    ]}
                    android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                    <Text style={[styles.privacyCardText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Button variant="ghost" style={{ flex: 1 }} onPress={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              style={{ flex: 1 }}
              loading={saveMut.isPending}
              disabled={!canSave}
              onPress={() =>
                saveMut.mutate({
                  title: title.trim(),
                  message: message.trim(),
                  category: category.trim() || null,
                  privacy,
                })
              }
            >
              Publicar
            </Button>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  privacyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: theme.colors.foregroundDark,
    lineHeight: 20,
  },
  categoryChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(107,115,128,0.06)",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
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
    maxHeight: "90%",
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  privacyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  privacyCard: {
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
  },
  privacyCardText: {
    fontSize: 12,
    fontWeight: "700",
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
