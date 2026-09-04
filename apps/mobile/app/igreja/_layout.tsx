import React from "react";
import { Stack } from "expo-router";
import { theme } from "@/constants/theme";

export default function IgrejaLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { color: "#FFFFFF", fontWeight: "700" },
        headerBackTitle: "Voltar",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="eventos"
        options={{
          title: "Eventos",
        }}
      />
      <Stack.Screen
        name="eventos/[id]"
        options={{
          title: "Detalhe do evento",
        }}
      />
      <Stack.Screen
        name="celulas"
        options={{
          title: "Células",
        }}
      />
      <Stack.Screen
        name="discipulado"
        options={{
          title: "Discipulado",
        }}
      />
      <Stack.Screen
        name="discipulado/rede"
        options={{
          title: "Rede de discipulado",
        }}
      />
      <Stack.Screen
        name="ministerios"
        options={{
          title: "Ministérios",
        }}
      />
      <Stack.Screen
        name="projetos"
        options={{
          title: "Projetos e ofertas",
        }}
      />
      <Stack.Screen
        name="oracao"
        options={{
          title: "Pedido de oração",
        }}
      />
    </Stack>
  );
}
