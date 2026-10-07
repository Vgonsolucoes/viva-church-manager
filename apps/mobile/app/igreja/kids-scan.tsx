import React, { useEffect, useState, useCallback } from "react";
import { Platform, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import { Flashlight, ChevronLeft } from "lucide-react-native";
import { SecondaryButton } from "@/components/SecondaryButton";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { theme } from "@/theme";

const VIEWFINDER_SIZE = 240;
const CORNER_SIZE = 28;
const CORNER_BORDER = 3;

export default function KidsScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" && permission && !permission.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const onBarCodeScanned = useCallback(
    (data: string) => {
      if (!scanningEnabled) return;
      setScanningEnabled(false);
      router.replace({
        pathname: "/igreja/kids-checkin",
        params: { token: data },
      });
    },
    [scanningEnabled, router],
  );

  if (!permission) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={["top", "left", "right", "bottom"]}
      >
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
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          edges={["top", "left", "right", "bottom"]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
              <ChevronLeft size={22} color={theme.colors.foreground} />
            </Pressable>
            <Text style={styles.headerTitle}>Check-in Kids</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg }}>
            <View style={styles.permissionCard}>
              <View
                style={[styles.permissionIcon, { backgroundColor: "rgba(23,107,255,0.14)" }]}
              >
                <Flashlight size={34} color={theme.colors.primary400} />
              </View>
              <Text style={styles.permissionTitle}>Precisamos da câmera</Text>
              <Text style={styles.permissionDesc}>
                Para fazer o check-in, escaneie o QR Code fixado na entrada do Ministério
                Infantil.
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
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => onBarCodeScanned(data)}
            enableTorch={torchOn}
          />

          <View style={styles.overlay}>
            <View style={styles.headerRowOverlay}>
              <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
                <ChevronLeft size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.headerTitleOverlay}>Check-in Kids</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.viewfinderWrap}>
              <View
                style={[styles.viewfinder, { width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE }]}
              >
                <View
                  style={[
                    styles.corner,
                    { top: 0, left: 0, borderTopWidth: CORNER_BORDER, borderLeftWidth: CORNER_BORDER, borderColor: theme.colors.primary400, width: CORNER_SIZE, height: CORNER_SIZE },
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    { top: 0, right: 0, borderTopWidth: CORNER_BORDER, borderRightWidth: CORNER_BORDER, borderColor: theme.colors.primary400, width: CORNER_SIZE, height: CORNER_SIZE },
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    { bottom: 0, left: 0, borderBottomWidth: CORNER_BORDER, borderLeftWidth: CORNER_BORDER, borderColor: theme.colors.primary400, width: CORNER_SIZE, height: CORNER_SIZE },
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    { bottom: 0, right: 0, borderBottomWidth: CORNER_BORDER, borderRightWidth: CORNER_BORDER, borderColor: theme.colors.primary400, width: CORNER_SIZE, height: CORNER_SIZE },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.hintText}>Aponte para o QR Code do Kids</Text>
            <Text style={styles.hintSubtitle}>
              O QR Code está fixado na entrada do Ministério Infantil
            </Text>

            <View style={{ flex: 1 }} />

            <View style={styles.footerRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.ghostBtn,
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
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  cameraRoot: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
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
  viewfinder: { position: "relative" },
  corner: { position: "absolute", borderRadius: 2 },
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
  noPermWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md },
  noPermText: { ...theme.typography.body, color: theme.colors.foregroundMuted },
});
