import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View, Text } from "react-native";
import { theme } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { color: "#FFFFFF", fontWeight: "700", fontSize: 18 },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: "#8A93A5",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
      backBehavior="history"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarLabel: "Início",
          headerTitle: "Olá, Viva Sede",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} label="Início" />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarLabel: "Agenda",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} color={color} label="Agenda" />
          ),
        }}
      />
      <Tabs.Screen
        name="escalas"
        options={{
          title: "Escalas",
          tabBarLabel: "Escalas",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "clipboard" : "clipboard-outline"} color={color} label="Escalas" />
          ),
        }}
      />
      <Tabs.Screen
        name="celulas"
        options={{
          title: "Células",
          tabBarLabel: "Células",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "people" : "people-outline"} color={color} label="Células" />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarLabel: "Perfil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person-circle" : "person-circle-outline"} color={color} label="Perfil" />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, label }: { name: any; color: string; label: string }) {
  return (
    <View style={styles.tabWrapper}>
      <Ionicons name={name as any} size={24} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabWrapper: { alignItems: "center", gap: 2, minWidth: 60 },
  tabLabel: { fontSize: 11, fontWeight: "600" },
});
