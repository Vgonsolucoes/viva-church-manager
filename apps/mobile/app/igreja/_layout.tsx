import React from "react";
import { Stack } from "expo-router";
import { theme } from "@/theme";

export default function IgrejaLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerTitleStyle: {
          color: theme.colors.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 18,
        },
        headerBackTitleStyle: {
          fontFamily: "Inter_500Medium",
        },
        headerBackTitle: "Voltar",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="eventos"
        options={{ title: "Eventos" }}
      />
      <Stack.Screen
        name="eventos/[id]"
        options={{ title: "Detalhe do evento" }}
      />
      <Stack.Screen
        name="celulas/index"
        options={{ title: "Minha Célula" }}
      />
      <Stack.Screen
        name="discipulado/index"
        options={{ title: "Discipulado" }}
      />
      <Stack.Screen
        name="discipulado/rede"
        options={{ title: "Minha Rede" }}
      />
      <Stack.Screen
        name="ministerios"
        options={{ title: "Ministérios" }}
      />
      <Stack.Screen
        name="projetos"
        options={{ title: "Projetos e ofertas" }}
      />
      <Stack.Screen
        name="oracao"
        options={{ title: "Pedido de oração" }}
      />
      <Stack.Screen
        name="infantil"
        options={{ title: "Meus filhos" }}
      />
      <Stack.Screen
        name="notifications"
        options={{ title: "Notificações" }}
      />
    </Stack>
  );
}
