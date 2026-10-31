import React from "react";
import { View, Text } from "react-native";
import { usePathname, useRouter, useLocalSearchParams } from "expo-router";
import { useSessionStore } from "@/stores/session";
import { Button } from "@/components/Button";
import { useAppTheme } from "@/theme";

export function MobileAccessGuard({ children }: { children: React.ReactNode }) {
  const me = useSessionStore(s => s.me);
  const pathname = usePathname();
  const { channel } = useLocalSearchParams<{ channel?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const modules = me?.access?.mobileModules;
  const key = pathname === "/igreja/avisos-projecao" ? (channel === "PARKING" ? "parking" : "kidsProjection") : pathname === "/" ? "home" : pathname === "/agenda" ? "agenda" : pathname === "/escalas" ? "schedules" : pathname === "/infantil" || /^\/igreja\/(infantil|kids-)/.test(pathname) ? "kids" : pathname.startsWith("/igreja/cultos") ? "services" : pathname.startsWith("/igreja/eventos") ? "events" : pathname.startsWith("/igreja/celulas") ? "cells" : pathname.startsWith("/igreja/discipulado") ? "discipleships" : pathname === "/igreja/projetos" ? "projects" : pathname === "/igreja/oracao" ? "prayer" : pathname === "/igreja/notifications" ? "notifications" : pathname === "/igreja/ministerios" ? "ministries" : pathname === "/qr/scan" ? "qr" : undefined;
  const allowed = !key || !modules || modules.includes(key) || (key === "qr" && modules.includes("kids"));
  if (allowed) return <>{children}</>;
  return <View style={{ flex: 1, padding: 28, justifyContent: "center", gap: 18, backgroundColor: theme.colors.background }}><Text style={{ color: theme.colors.foreground, fontSize: 22, fontWeight: "700" }}>Acesso não disponível</Text><Text style={{ color: theme.colors.foregroundMuted }}>Este módulo não está liberado para o seu cadastro. Consulte a administração da igreja.</Text><Button onPress={() => router.replace("/perfil")}>Ir para meu perfil</Button></View>;
}
