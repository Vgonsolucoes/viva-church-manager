import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  User,
  Mail,
  Phone,
  Building2,
  Camera,
  Save,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { AppCard } from "@/components/AppCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { theme } from "@/theme";
import { useAuth } from "@/hooks/useAuth";
import { patchProfile } from "@/services/api/profile";
import { getMyCell } from "@/services/api/cellsMy";

const STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export default function PerfilEditarScreen() {
  const router = useRouter();
  const { me, refreshMe, initialized } = useAuth();
  const queryClient = useQueryClient();

  const member = me?.member;
  const [photoUrl, setPhotoUrl] = useState(me?.image ?? member?.photoUrl ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [addressLine1, setAddressLine1] = useState((member as any)?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState((member as any)?.addressLine2 ?? "");
  const [neighborhood, setNeighborhood] = useState((member as any)?.neighborhood ?? "");
  const [city, setCity] = useState((member as any)?.city ?? "");
  const [state, setState] = useState((member as any)?.state ?? "");
  const [zip, setZip] = useState((member as any)?.zip ?? "");

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const cellQuery = useQuery({
    queryKey: ["my-cell-edit"],
    queryFn: () => getMyCell(),
    staleTime: 60_000,
    enabled: !!initialized,
  });

  const saveMut = useMutation({
    mutationFn: (p: Parameters<typeof patchProfile>[0]) => patchProfile(p),
    onSuccess: async () => {
      await refreshMe(true);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      setToast({ type: "success", text: "Perfil atualizado com sucesso!" });
      setTimeout(() => setToast(null), 2600);
    },
    onError: (e) => {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Não foi possível salvar as alterações.",
      });
      setTimeout(() => setToast(null), 3500);
    },
  });

  const normalizedZip = useMemo(() => zip.replace(/\D/g, "").slice(0, 8), [zip]);

  const ministries = me?.ministries ?? [];
  const myCell = cellQuery.data;

  const changePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setToast({ type: "error", text: "Permita o acesso à galeria para trocar a foto." });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setPhotoUrl(result.assets[0].uri);
      }
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Não foi possível selecionar a imagem.",
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const onSave = useCallback(() => {
    const payload: Parameters<typeof patchProfile>[0] = {
      phone: phone || null,
      email: email || undefined,
      photoUrl: photoUrl || null,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      neighborhood: neighborhood || null,
      city: city || null,
      state: state || null,
      zip: normalizedZip || null,
    };
    void saveMut.mutateAsync(payload);
  }, [phone, email, photoUrl, addressLine1, addressLine2, neighborhood, city, state, normalizedZip, saveMut]);

  const isLoading = saveMut.isPending || !initialized;

  return (
    <>
      <Stack.Screen options={{ title: "Editar perfil", headerShown: true }} />
      <AppHeader title="Editar perfil" showBack />
      <ScreenContainer
        scrollable={false}
        padded
        edges={["left", "right", "bottom"]}
        noTopPadding
        keyboardAvoiding
        backgroundColor={theme.colors.background}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: 180, gap: theme.spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.photoSection}>
              <View style={styles.avatarWrap}>
                {isLoading ? (
                  <LoadingSkeleton width={96} height={96} borderRadius={48} />
                ) : (
                  <Avatar
                    src={photoUrl || null}
                    name={me?.name}
                    size="lg"
                    ringColor={theme.colors.primary400}
                    ringWidth={2}
                  />
                )}
                <Pressable
                  style={styles.photoEditBtn}
                  onPress={changePhoto}
                  hitSlop={8}
                >
                  <Camera size={16} color="#FFFFFF" />
                </Pressable>
              </View>
              <SecondaryButton
                title="Trocar foto"
                variant="outline"
                height={44}
                onPress={changePhoto}
                style={{ marginTop: theme.spacing.sm }}
              />
            </View>

            {(ministries.length > 0 || myCell) ? (
              <AppCard variant="outlined">
                <View style={{ gap: theme.spacing.md }}>
                  {ministries.length > 0 ? (
                    <View>
                      <Text style={styles.sectionSubtitle}>Ministérios</Text>
                      <View style={styles.badgesRow}>
                        {ministries.map((m) => (
                          <Badge
                            key={m.id}
                            label={m.name}
                            variant="primary"
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {myCell ? (
                    <View>
                      <Text style={styles.sectionSubtitle}>Célula</Text>
                      <View style={styles.badgesRow}>
                        <StatusBadge status="CONFIRMED" customLabel={myCell.name} />
                      </View>
                    </View>
                  ) : null}
                </View>
              </AppCard>
            ) : null}

            <AppCard variant="default">
              {isLoading ? (
                <View style={{ gap: theme.spacing.md }}>
                  <LoadingSkeleton variant="line" height={48} borderRadius={12} />
                  <LoadingSkeleton variant="line" height={48} borderRadius={12} />
                </View>
              ) : (
                <View style={{ gap: theme.spacing.md }}>
                  <Input
                    label="Nome completo"
                    value={me?.name ?? member?.fullName ?? ""}
                    onChangeText={() => {}}
                    leftIcon={<User size={18} color={theme.colors.foregroundMuted} />}
                    editable={false}
                  />
                  <Input
                    label="E-mail"
                    value={email}
                    onChangeText={setEmail}
                    leftIcon={<Mail size={18} color={theme.colors.foregroundMuted} />}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="voce@exemplo.com"
                  />
                  <Input
                    label="Telefone"
                    value={phone}
                    onChangeText={setPhone}
                    leftIcon={<Phone size={18} color={theme.colors.foregroundMuted} />}
                    keyboardType="phone-pad"
                    placeholder="(00) 00000-0000"
                  />
                </View>
              )}
            </AppCard>

            <AppCard variant="default">
              <Text style={styles.cardTitle}>Endereço</Text>
              {isLoading ? (
                <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                  <LoadingSkeleton variant="line" height={48} borderRadius={12} />
                  <LoadingSkeleton variant="line" height={48} borderRadius={12} />
                  <LoadingSkeleton variant="line" height={48} borderRadius={12} width="75%" />
                </View>
              ) : (
                <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                  <Input
                    label="Endereço (linha 1)"
                    value={addressLine1}
                    onChangeText={setAddressLine1}
                    leftIcon={<Building2 size={18} color={theme.colors.foregroundMuted} />}
                    placeholder="Rua, número, bairro breve"
                  />
                  <Input
                    label="Complemento (linha 2)"
                    value={addressLine2}
                    onChangeText={setAddressLine2}
                    leftIcon={<Building2 size={18} color={theme.colors.foregroundMuted} />}
                    placeholder="Apto, bloco, referência"
                  />
                  <Input
                    label="Bairro"
                    value={neighborhood}
                    onChangeText={setNeighborhood}
                    leftIcon={<Building2 size={18} color={theme.colors.foregroundMuted} />}
                  />
                  <Input
                    label="Cidade"
                    value={city}
                    onChangeText={setCity}
                    leftIcon={<Building2 size={18} color={theme.colors.foregroundMuted} />}
                  />
                  <Pressable
                    onPress={() => setShowStatePicker(true)}
                    style={({ pressed }) => [
                      styles.stateButton,
                      pressed && { opacity: 0.88, transform: [{ scale: 0.975 }] },
                    ]}
                  >
                    <View style={styles.stateInnerLeft}>
                      <Building2 size={18} color={theme.colors.foregroundMuted} />
                      <View style={{ marginLeft: theme.spacing.md }}>
                        <Text style={styles.stateLabel}>Estado</Text>
                        <Text style={[styles.stateValue, !state && { color: theme.colors.foregroundMuted }]}>
                          {state || "Selecione um estado (UF)"}
                        </Text>
                      </View>
                    </View>
                    <ChevronDown size={18} color={theme.colors.foregroundMuted} />
                  </Pressable>
                  <Input
                    label="CEP (8 dígitos)"
                    value={zip}
                    onChangeText={(t) => setZip(t.replace(/\D/g, "").slice(0, 8))}
                    leftIcon={<Building2 size={18} color={theme.colors.foregroundMuted} />}
                    keyboardType="number-pad"
                    placeholder="00000000"
                    maxLength={8}
                  />
                </View>
              )}
            </AppCard>
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton
              title={saveMut.isPending ? "Salvando..." : "SALVAR"}
              onPress={onSave}
              variant="solid"
              loading={saveMut.isPending}
              disabled={saveMut.isPending}
              leftIcon={!saveMut.isPending ? <Save size={18} color="#FFFFFF" /> : undefined}
            />
          </View>
        </KeyboardAvoidingView>
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
          {toast.type === "success" ? (
            <CheckCircle2 size={20} color="#FFFFFF" />
          ) : (
            <AlertCircle size={20} color="#FFFFFF" />
          )}
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.text}
          </Text>
        </View>
      ) : null}

      <Modal
        visible={showStatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatePicker(false)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setShowStatePicker(false)}
        >
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecione o estado</Text>
              <Pressable onPress={() => setShowStatePicker(false)} hitSlop={10}>
                <X size={22} color={theme.colors.foregroundMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
              <View style={styles.statesGrid}>
                {STATES.map((uf) => {
                  const selected = state === uf;
                  return (
                    <Pressable
                      key={uf}
                      onPress={() => {
                        setState(uf);
                        setShowStatePicker(false);
                      }}
                      style={({ pressed }) => [
                        styles.stateChip,
                        selected && styles.stateChipActive,
                        pressed && { opacity: 0.86, transform: [{ scale: 0.95 }] },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stateChipText,
                          selected && styles.stateChipTextActive,
                        ]}
                      >
                        {uf}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  photoSection: {
    alignItems: "center",
    paddingTop: theme.spacing.sm,
  },
  avatarWrap: {
    position: "relative",
  },
  photoEditBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary500,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  cardTitle: {
    ...theme.typography.captionBold,
    color: theme.colors.primary400,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    ...theme.typography.captionBold,
    color: theme.colors.foregroundMuted,
    letterSpacing: 0.4,
    marginBottom: theme.spacing.sm,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  stateButton: {
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.input,
    borderWidth: 0.6,
    borderColor: theme.colors.white16,
    paddingHorizontal: theme.spacing.md,
  },
  stateInnerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  stateLabel: {
    fontSize: 11,
    color: theme.colors.foregroundMuted,
    fontWeight: "600",
    fontFamily: theme.fontFamilies.semibold,
  },
  stateValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.regular,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.white08,
  },
  toast: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: 96,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 100,
  },
  toastText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: theme.fontFamilies.bold,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "70%",
  },
  pickerHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.white16,
    marginTop: 10,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 6,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
  },
  statesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stateChip: {
    width: "18%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.white16,
    backgroundColor: theme.colors.card,
  },
  stateChipActive: {
    backgroundColor: theme.colors.primary500,
    borderColor: theme.colors.primary500,
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.bold,
  },
  stateChipTextActive: {
    color: "#FFFFFF",
  },
});
