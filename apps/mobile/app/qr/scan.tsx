import React, { useEffect, useRef, useState, useCallback } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/constants/theme";
import { postScan } from "@/services/api/qr";
import type { QrScanResult } from "@/types";
import { formatDateTime } from "@/utils/date";

export default function QrScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [result, setResult] = useState<QrScanResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
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
      <Screen backgroundBrand title="Escanear QR" loading loadingLabel="Preparando câmera...">
        <View />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: "Escanear QR" }} />
        <Screen backgroundBrand title="Permissão necessária">
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name="camera-outline" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.permissionTitle}>Precisamos da câmera</Text>
            <Text style={styles.permissionDesc}>
              Para escanear o cartão de membro, check-ins e ingressos de eventos, autorize o
              acesso à câmera abaixo.
            </Text>
            <Button
              variant="primary"
              loading={permission.canAskAgain && permission.status === "undetermined"}
              onPress={() => void requestPermission()}
            >
              {permission.canAskAgain ? "Conceder permissão" : "Abrir configurações"}
            </Button>
          </View>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Escanear QR" }} />
      <Screen backgroundBrand noSafeArea scrollable={false} padded={false} loading={false}>
        <View style={styles.cameraRoot}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417", "code128"],
            }}
            onBarcodeScanned={({ data }) => onBarCodeScanned(data)}
            enableTorch={false}
          />
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddleRow}>
              <View style={styles.overlaySide} />
              <View style={styles.viewfinderWrap}>
                <View style={styles.viewfinder}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                </View>
                <View style={styles.scanLineWrap}>
                  <View style={styles.scanLine} />
                </View>
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <Text style={styles.hintText}>
                Aponte a câmera para o QR code do cartão de membro, check-in ou ingresso.
              </Text>
            </View>
          </View>
          {scanMut.isPending ? (
            <View style={styles.scanningOverlay}>
              <LoadingSpinner color="#FFFFFF" />
              <Text style={styles.scanningText}>Validando...</Text>
            </View>
          ) : null}
        </View>
      </Screen>

      <Modal visible={showResult} transparent animationType="fade" onRequestClose={resetScan}>
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            {scanMut.isPending || (!result && !scanError) ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <LoadingSpinner />
              </View>
            ) : scanError ? (
              <>
                <View style={[styles.resultIcon, { backgroundColor: theme.colors.destructiveSoft }]}>
                  <Ionicons name="alert-circle-outline" size={34} color={theme.colors.destructive} />
                </View>
                <Text style={styles.resultTitle}>Não foi possível validar</Text>
                <Text style={styles.resultText}>{scanError}</Text>
              </>
            ) : result ? (
              <>
                <View
                  style={[
                    styles.resultIcon,
                    {
                      backgroundColor: result.valid
                        ? "rgba(23, 201, 100, 0.18)"
                        : theme.colors.destructiveSoft,
                    },
                  ]}
                >
                  <Ionicons
                    name={result.valid ? "checkmark" : "close"}
                    size={34}
                    color={result.valid ? theme.colors.success : theme.colors.destructive}
                  />
                </View>
                <Text
                  style={[
                    styles.resultTitle,
                    { color: result.valid ? theme.colors.success : theme.colors.destructive },
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
                    size={72}
                    style={{ alignSelf: "center", marginTop: 8 }}
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
            <View style={{ marginTop: 16, gap: 10 }}>
              <Button variant="primary" fullWidth onPress={resetScan}>
                Esanear outro
              </Button>
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
      <Text style={styles.badgeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionCard: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: theme.radius.lg,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  permissionDesc: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  overlayTop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  overlayMiddleRow: {
    flexDirection: "row",
    height: 260,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  viewfinderWrap: {
    width: 260,
    height: 260,
    position: "relative",
  },
  viewfinder: {
    width: "100%",
    height: "100%",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: theme.colors.primary,
    borderWidth: 4,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLineWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanLine: {
    width: "80%",
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    paddingHorizontal: 32,
    paddingTop: 24,
    alignItems: "center",
  },
  hintText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
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
    gap: 12,
  },
  scanningText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  resultOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  resultCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: theme.radius.xl,
    padding: 20,
    gap: 10,
    alignItems: "center",
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.foregroundDark,
  },
  resultMain: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.foregroundDark,
    textAlign: "center",
  },
  resultText: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  badgeLine: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  badgeValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.foregroundDark,
  },
});
