import React, { useEffect, useRef, useState, useCallback } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { Flashlight, Image as ImageIcon, ChevronLeft } from "lucide-react-native";
import { Pressable } from "react-native";
import { Avatar } from "@/components/Avatar";
import { SecondaryButton } from "@/components/SecondaryButton";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/theme";
import { postScan } from "@/services/api/qr";
import type { QrScanResult } from "@/types";
import { formatDateTime } from "@/utils/date";

const VIEWFINDER_SIZE = 240;
const CORNER_SIZE = 28;
const CORNER_BORDER = 3;

export default function QrScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [result, setResult] = useState<QrScanResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const scanMutRef = useRef<ReturnType<typeof postScan> | null>(null);

  const scanMut = useMutation({
    mutationFn: (token: string) => {
      const p = postScan({ token });
      scanMutRef.current = p;
      return p;
    },
    onSuccess: (data) => {
      setResult(data);
      setShowResult(true);
    },
    onError: (e) => {
      setScanError(e instanceof Error ? e.message : "Erro ao validar QR");
      setShowResult(true);
    },
  });

  useEffect(() => {
    if (Platform.OS !== "web" && permission && !permission.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const onBarCodeScanned = useCallback(
    (data: string) => {
      if (!scanningEnabled) return;
      setScanningEnabled(false);
      void scanMut.mutateAsync(data);
    },
    [scanningEnabled, scanMut],
  );

  const resetScan = () => {
    setResult(null);
    setScanError(null);
    setShowResult(false);
    setScanningEnabled(true);
  };

  if (!permission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.noPermWrap}>
          <LoadingSpinner />
          <Text style={styles.noPermText}>Preparando câmera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: "Escanear QR", headerShown: false }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top", "left", "right", "bottom"]}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
              <ChevronLeft size={22} color={theme.colors.foreground} />
            </Pressable>
            <Text style={styles.headerTitle}>Escanear QR</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg }}>
            <View style={styles.permissionCard}>
              <View style={[styles.permissionIcon, { backgroundColor: "rgba(23,107,255,0.14)" }]}>
                <Flashlight size={34} color={theme.colors.primary400} />
              </View>
              <Text style={styles.permissionTitle}>Precisamos da câmera</Text>
              <Text style={styles.permissionDesc}>
                Para escanear o cartão de membro, check-ins e ingressos de eventos, autorize o
                acesso à câmera abaixo.
              </Text>
              <View style={{ width: "100%", marginTop: theme.spacing.lg }}>
                <SecondaryButton
                  title={permission.canAskAgain ? "Conceder permissão" : "Abrir configurações"}
                  onPress={() => void requestPermission()}
                  style={{ backgroundColor: theme.colors.primary500 }}
                  textStyle={{ color: "#FFFFFF" }}
                />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.cameraRoot}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417", "code128"],
            }}
            onBarcodeScanned={({ data }) => onBarCodeScanned(data)}
            enableTorch={torchOn}
          />

          <View style={styles.overlay}>
            <View style={styles.headerRowOverlay}>
              <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
                <ChevronLeft size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.headerTitleOverlay}>Escanear QR</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.viewfinderWrap}>
              <View style={[styles.viewfinder, { width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE }]}>
                <View
                  style={[
                    styles.corner,
                    styles.cornerTL,
                    {
                      width: CORNER_SIZE,
                      height: CORNER_SIZE,
                      borderTopWidth: CORNER_BORDER,
                      borderLeftWidth: CORNER_BORDER,
                      borderColor: theme.colors.primary400,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerTR,
                    {
                      width: CORNER_SIZE,
                      height: CORNER_SIZE,
                      borderTopWidth: CORNER_BORDER,
                      borderRightWidth: CORNER_BORDER,
                      borderColor: theme.colors.primary400,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBL,
                    {
                      width: CORNER_SIZE,
                      height: CORNER_SIZE,
                      borderBottomWidth: CORNER_BORDER,
                      borderLeftWidth: CORNER_BORDER,
                      borderColor: theme.colors.primary400,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBR,
                    {
                      width: CORNER_SIZE,
                      height: CORNER_SIZE,
                      borderBottomWidth: CORNER_BORDER,
                      borderRightWidth: CORNER_BORDER,
                      borderColor: theme.colors.primary400,
                    },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.hintText}>Aponte a câmera para o QR Code</Text>
            <Text style={styles.hintSubtitle}>
              Cartão de membro, check-in ou ingresso de evento
            </Text>

            <View style={{ flex: 1 }} />

            <View style={styles.footerRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.ghostBtn,
                  { flex: 1, marginRight: theme.spacing.sm },
                  pressed && { opacity: 0.86, transform: [{ scale: 0.975 }] },
                ]}
                onPress={() => setTorchOn((v) => !v)}
              >
                <Flashlight
                  size={18}
                  color={theme.colors.primary400}
                  fill={torchOn ? "rgba(23,107,255,0.25)" : undefined}
                />
                <Text style={[styles.ghostBtnText, { marginLeft: 8 }]}>
                  {torchOn ? "Luz ligada" : "Flash"}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.ghostBtn,
                  { flex: 1, marginLeft: theme.spacing.sm },
                  pressed && { opacity: 0.86, transform: [{ scale: 0.975 }] },
                ]}
                onPress={() => {}}
              >
                <ImageIcon size={18} color={theme.colors.primary400} />
                <Text style={[styles.ghostBtnText, { marginLeft: 8 }]}>Galeria</Text>
              </Pressable>
            </View>
          </View>

          {scanMut.isPending ? (
            <View style={styles.scanningOverlay}>
              <LoadingSpinner color="#FFFFFF" />
              <Text style={styles.scanningText}>Validando...</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <Modal visible={showResult} transparent animationType="fade" onRequestClose={resetScan}>
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            {scanMut.isPending || (!result && !scanError) ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <LoadingSpinner />
              </View>
            ) : scanError ? (
              <>
                <View style={[styles.resultIcon, { backgroundColor: "rgba(240,68,56,0.14)" }]}>
                  <Text style={{ color: theme.colors.danger500, fontSize: 30, fontFamily: theme.fontFamilies.bold, lineHeight: 34 }}>!</Text>
                </View>
                <Text style={[styles.resultTitle, { color: theme.colors.danger500 }]}>
                  Não foi possível validar
                </Text>
                <Text style={styles.resultText}>{scanError}</Text>
              </>
            ) : result ? (
              <>
                <View
                  style={[
                    styles.resultIcon,
                    {
                      backgroundColor: result.valid
                        ? "rgba(34,201,149,0.16)"
                        : "rgba(240,68,56,0.14)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.resultCheckMark,
                      { color: result.valid ? theme.colors.green500 : theme.colors.danger500 },
                    ]}
                  >
                    {result.valid ? "✓" : "×"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.resultTitle,
                    { color: result.valid ? theme.colors.green500 : theme.colors.danger500 },
                  ]}
                >
                  {result.valid ? "QR válido" : "QR inválido"}
                </Text>
                {result.title ? (
                  <Text style={styles.resultMain}>{result.title}</Text>
                ) : null}
                {result.photoUrl || !!(result as any).memberId ? (
                  <Avatar
                    src={result.photoUrl ?? null}
                    name={result.title ?? "Membro"}
                    size="lg"
                    style={{ alignSelf: "center", marginTop: theme.spacing.md }}
                  />
                ) : null}
                {result.subtitle ? (
                  <Text style={styles.resultText}>{result.subtitle}</Text>
                ) : null}
                {result.type ? (
                  <BadgeLine label="Tipo" value={result.type} />
                ) : null}
                <BadgeLine
                  label="Escaneado em"
                  value={formatDateTime(result.scannedAt)}
                />
              </>
            ) : null}
            <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm, width: "100%" }}>
              <SecondaryButton
                title="Escanear outro"
                onPress={resetScan}
                style={{ backgroundColor: theme.colors.primary500 }}
                textStyle={{ color: "#FFFFFF" }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function BadgeLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.badgeLine}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerRowOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  headerTitleOverlay: {
    ...theme.typography.card,
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.semibold,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  headerTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
  },
  viewfinderWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: theme.spacing.md,
  },
  viewfinder: {
    position: "relative",
  },
  corner: {
    position: "absolute",
    borderRadius: 2,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopLeftRadius: 2,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopRightRadius: 2,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomLeftRadius: 2,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomRightRadius: 2,
  },
  hintText: {
    ...theme.typography.heading,
    color: "#FFFFFF",
    fontFamily: theme.fontFamilies.semibold,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
  hintSubtitle: {
    ...theme.typography.subtle,
    color: "rgba(255,255,255,0.72)",
    fontFamily: theme.fontFamilies.regular,
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  footerRow: {
    flexDirection: "row",
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
  },
  ghostBtn: {
    height: 52,
    borderRadius: theme.radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: "rgba(23,107,255,0.10)",
    flexDirection: "row",
  },
  ghostBtnText: {
    color: theme.colors.primary400,
    ...theme.typography.button,
    fontFamily: theme.fontFamilies.semibold,
  },
  scanningOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  scanningText: {
    color: "#FFFFFF",
    ...theme.typography.bodyBold,
    fontFamily: theme.fontFamilies.semibold,
  },
  permissionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginTop: theme.spacing.xl,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.bold,
    textAlign: "center",
  },
  permissionDesc: {
    ...theme.typography.body,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  resultOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  resultCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  resultCheckMark: {
    fontSize: 34,
    fontFamily: theme.fontFamilies.bold,
    lineHeight: 38,
  },
  resultTitle: {
    ...theme.typography.heading,
    fontFamily: theme.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  resultMain: {
    ...theme.typography.card,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
    textAlign: "center",
  },
  resultText: {
    ...theme.typography.bodySm,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  badgeLine: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    marginTop: theme.spacing.xs,
  },
  badgeLabel: {
    ...theme.typography.caption,
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamilies.semibold,
    letterSpacing: 0.3,
  },
  badgeValue: {
    flex: 1,
    textAlign: "right",
    ...theme.typography.bodySm,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamilies.semibold,
  },
  noPermWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  noPermText: {
    ...theme.typography.body,
    color: theme.colors.foregroundMuted,
  },
});
