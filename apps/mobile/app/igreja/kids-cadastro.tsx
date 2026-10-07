import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, Save, Baby, AlertCircle } from "lucide-react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { AppCard } from "@/components/AppCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Input } from "@/components/Input";
import { theme } from "@/theme";
import {
  createChild,
  getMyChildren,
  updateChild,
  uploadChildPhoto,
  type ChildPayload,
} from "@/services/api/kids";

function formatBirthInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthInputToIso(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4));
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function birthDateToInput(date: Date | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export default function KidsCadastroScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const isEdit = Boolean(childId);

  const childrenQuery = useQuery({
    queryKey: ["my-children"],
    queryFn: () => getMyChildren(),
    staleTime: 30_000,
    enabled: isEdit,
  });
  const editingChild = childId
    ? childrenQuery.data?.find((c) => c.id === childId)
    : undefined;

  const [initialized, setInitialized] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<"MALE" | "FEMALE" | null>(null);
  const [photoUri, setPhotoUri] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isEdit || initialized || !editingChild) return;
    setFullName(editingChild.fullName);
    setBirthDate(birthDateToInput(editingChild.birthDate));
    setSex(editingChild.sex ?? null);
    setPhotoUri(editingChild.photoUrl ?? "");
    setAllergies(editingChild.allergies ?? "");
    setMedications(editingChild.medications ?? "");
    setSpecialNeeds(editingChild.specialNeeds ?? "");
    setEmergencyContact(editingChild.emergencyContact ?? "");
    setNotes(editingChild.notes ?? "");
    setInitialized(true);
  }, [isEdit, initialized, editingChild]);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const saveMut = useMutation({
    mutationFn: async () => {
      let photoUrl: string | null = photoUri || null;
      if (photoUri && !photoUri.startsWith("/uploads/")) {
        photoUrl = await uploadChildPhoto(photoUri);
      }

      const payload: ChildPayload = {
        fullName: fullName.trim(),
        birthDate: birthInputToIso(birthDate),
        sex,
        photoUrl,
        allergies: allergies.trim() || null,
        medications: medications.trim() || null,
        specialNeeds: specialNeeds.trim() || null,
        emergencyContact: emergencyContact.trim() || null,
        notes: notes.trim() || null,
      };

      if (isEdit && childId) {
        return updateChild(childId, payload);
      }
      return createChild(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-children"] });
      showToast(
        "success",
        isEdit ? "Cadastro atualizado com sucesso!" : "Filho(a) cadastrado(a) com sucesso!",
      );
      setTimeout(() => router.back(), 600);
    },
    onError: (e) => {
      showToast(
        "error",
        e instanceof Error ? e.message : "Não foi possível salvar o cadastro.",
      );
    },
  });

  const changePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast("error", "Permita o acesso à galeria para adicionar a foto.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      showToast("error", "Não foi possível selecionar a imagem.");
    }
  }, [showToast]);

  const onSave = useCallback(() => {
    setFormError(null);
    if (fullName.trim().length < 2) {
      setFormError("Informe o nome completo da criança.");
      return;
    }
    if (birthDate.replace(/\D/g, "").length > 0 && !birthInputToIso(birthDate)) {
      setFormError("Data de nascimento inválida. Use DD/MM/AAAA.");
      return;
    }
    saveMut.mutate();
  }, [fullName, birthDate, saveMut]);

  const isSaving = saveMut.isPending;
  const editLoading = isEdit && childrenQuery.isLoading;

  return (
    <>
      <AppHeader
        title={isEdit ? "Editar filho(a)" : "Cadastrar filho(a)"}
        subtitle="Ministério Infantil"
        showBack
      />
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
            contentContainerStyle={{ paddingBottom: 120, gap: theme.spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.photoSection}>
              <View style={styles.avatarWrap}>
                <Avatar
                  src={photoUri || null}
                  name={fullName || " "}
                  size="lg"
                  ringColor={theme.colors.primary400}
                  ringWidth={2}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.cameraButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={changePhoto}
                  disabled={isSaving || editLoading}
                >
                  <Camera size={16} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text style={styles.photoHint}>Foto da criança (opcional)</Text>
            </View>

            <AppCard variant="default">
              <View style={{ gap: theme.spacing.md }}>
                <Input
                  label="Nome completo *"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Nome da criança"
                  autoCapitalize="words"
                  editable={!isSaving && !editLoading}
                />
                <Input
                  label="Data de nascimento"
                  value={birthDate}
                  onChangeText={(v) => setBirthDate(formatBirthInput(v))}
                  placeholder="DD/MM/AAAA"
                  keyboardType="number-pad"
                  editable={!isSaving && !editLoading}
                />

                <View>
                  <Text style={styles.fieldLabel}>Sexo</Text>
                  <View style={styles.sexRow}>
                    {(
                      [
                        { value: "MALE", label: "Masculino" },
                        { value: "FEMALE", label: "Feminino" },
                      ] as const
                    ).map((option) => {
                      const selected = sex === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.sexChip,
                            selected && styles.sexChipSelected,
                          ]}
                          onPress={() =>
                            setSex((current) =>
                              current === option.value ? null : option.value,
                            )
                          }
                          disabled={isSaving || editLoading}
                        >
                          <Text
                            style={[
                              styles.sexChipText,
                              selected && styles.sexChipTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            </AppCard>

            <AppCard variant="default">
              <View style={styles.healthHeader}>
                <AlertCircle size={16} color={theme.colors.primary400} />
                <Text style={styles.healthTitle}>Informações de saúde e segurança</Text>
              </View>
              <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                <Input
                  label="Alergias"
                  value={allergies}
                  onChangeText={setAllergies}
                  placeholder="Ex: amendoim, lactose..."
                  multiline
                  editable={!isSaving && !editLoading}
                />
                <Input
                  label="Medicamentos"
                  value={medications}
                  onChangeText={setMedications}
                  placeholder="Medicamentos em uso"
                  multiline
                  editable={!isSaving && !editLoading}
                />
                <Input
                  label="Necessidades especiais"
                  value={specialNeeds}
                  onChangeText={setSpecialNeeds}
                  placeholder="Ex: TEA, mobilidade reduzida..."
                  multiline
                  editable={!isSaving && !editLoading}
                />
                <Input
                  label="Contato de emergência"
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="Nome e telefone"
                  editable={!isSaving && !editLoading}
                />
                <Input
                  label="Observações"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Outras informações importantes"
                  multiline
                  editable={!isSaving && !editLoading}
                />
              </View>
            </AppCard>

            {formError ? (
              <Text style={styles.errorText}>{formError}</Text>
            ) : null}

            <PrimaryButton
              title={
                isSaving
                  ? "Salvando..."
                  : editLoading
                    ? "Carregando..."
                    : isEdit
                      ? "Salvar alterações"
                      : "Cadastrar"
              }
              variant="solid"
              loading={isSaving}
              disabled={isSaving || editLoading}
              leftIcon={
                isEdit ? (
                  <Save size={18} color="#FFFFFF" />
                ) : (
                  <Baby size={18} color="#FFFFFF" />
                )
              }
              onPress={onSave}
            />

            <Text style={styles.disclaimer}>
              Ao cadastrar, você será vinculado(a) automaticamente como
              responsável autorizado(a) desta criança.
            </Text>
          </ScrollView>
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
          <Text style={styles.toastText} numberOfLines={3}>
            {toast.text}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  photoSection: {
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  avatarWrap: {
    position: "relative",
  },
  cameraButton: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary400,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  photoHint: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
  },
  fieldLabel: {
    ...theme.typography.subtleBold,
    color: theme.colors.foregroundMuted,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  sexRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  sexChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: theme.radius.input,
    borderWidth: 0.6,
    borderColor: theme.colors.white16,
    backgroundColor: theme.colors.card,
  },
  sexChipSelected: {
    borderColor: theme.colors.primary400,
    backgroundColor: "rgba(94,92,230,0.15)",
  },
  sexChipText: {
    ...theme.typography.bodyBold,
    color: theme.colors.foregroundMuted,
  },
  sexChipTextSelected: {
    color: theme.colors.primary400,
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  healthTitle: {
    ...theme.typography.subtleBold,
    color: theme.colors.foregroundMuted,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger500,
    textAlign: "center",
  },
  disclaimer: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
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
