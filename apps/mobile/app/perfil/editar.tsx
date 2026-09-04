import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { theme } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { patchProfile } from "@/services/api/profile";

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
  const { me, refreshMe } = useAuth();
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

  const onSave = () => {
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
  };

  return (
    <>
      <Stack.Screen options={{ title: "Editar perfil" }} />
      <Screen backgroundBrand padded={false} scrollable={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.photoSection}>
              <View style={styles.avatarWrap}>
                {photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <Avatar name={me?.name} size={96} />
                )}
                <Pressable
                  style={styles.photoEditBtn}
                  onPress={changePhoto}
                  android_ripple={{ color: "rgba(255,255,255,0.22)", borderless: true }}
                >
                  <Ionicons name="camera" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
              <Button
                variant="outline"
                size="sm"
                leftIcon={
                  <Ionicons
                    name="image-outline"
                    size={16}
                    color={theme.colors.foregroundDark}
                  />
                }
                onPress={changePhoto}
              >
                Trocar imagem
              </Button>
            </View>

            <FieldGroup title="Contato">
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="voce@exemplo.com"
              />
              <Input
                label="Telefone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="(00) 00000-0000"
              />
            </FieldGroup>

            <FieldGroup title="Endereço">
              <Input
                label="Endereço (linha 1)"
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="Rua, número, bairro breve"
              />
              <Input
                label="Complemento (linha 2)"
                value={addressLine2}
                onChangeText={setAddressLine2}
                placeholder="Apto, bloco, referência"
              />
              <Input
                label="Bairro"
                value={neighborhood}
                onChangeText={setNeighborhood}
              />
              <Input
                label="Cidade"
                value={city}
                onChangeText={setCity}
              />
              <Pressable
                onPress={() => setShowStatePicker(true)}
                style={styles.stateButton}
                android_ripple={{ color: theme.colors.primarySoft, borderless: true }}
              >
                <View>
                  <Text style={styles.stateLabel}>Estado</Text>
                  <Text style={[styles.stateValue, !state && { color: theme.colors.muted }]}>
                    {state || "Selecione um estado (UF)"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={theme.colors.muted} />
              </Pressable>
              <Input
                label="CEP (8 dígitos)"
                value={zip}
                onChangeText={(t) => setZip(t.replace(/\D/g, "").slice(0, 8))}
                keyboardType="number-pad"
                placeholder="00000000"
                maxLength={8}
              />
            </FieldGroup>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={saveMut.isPending}
              leftIcon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
              onPress={onSave}
            >
              Salvar alterações
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Screen>

      {toast ? (
        <View
          style={[
            styles.toast,
            toast.type === "success"
              ? { backgroundColor: theme.colors.success }
              : { backgroundColor: theme.colors.destructive },
          ]}
        >
          <Ionicons
            name={toast.type === "success" ? "checkmark-circle" : "alert-circle"}
            size={20}
            color="#FFFFFF"
          />
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
                <Ionicons name="close" size={22} color={theme.colors.muted} />
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
                      style={[
                        styles.stateChip,
                        selected && styles.stateChipActive,
                      ]}
                      android_ripple={{
                        color: theme.colors.primarySoft,
                        borderless: true,
                      }}
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

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const arr = React.Children.toArray(children);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldGroupTitle}>{title}</Text>
      <View style={{ gap: 10 }}>
        {arr.map((c, i) => (
          <View key={i}>{c}</View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  photoSection: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 2,
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary,
  },
  photoEditBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: theme.colors.backgroundCard,
  },
  fieldGroup: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  fieldGroupTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  stateButton: {
    width: "100%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
  },
  stateLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  stateValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.foregroundDark,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  toastText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "70%",
  },
  pickerHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: 10,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
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
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
  },
  stateChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
  },
  stateChipTextActive: {
    color: "#FFFFFF",
  },
});
