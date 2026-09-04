import React from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform, StyleSheet, View, Text } from "react-native";
import { theme } from "@/constants/theme";

type TabIconName = keyof typeof MaterialCommunityIcons.glyphMap;

function TabIcon({
  name,
  color,
  label,
}: {
  name: TabIconName;
  color: string;
  label: string;
}) {
  return (
    <View style={styles.tabWrapper}>
      <MaterialCommunityIcons name={name} size={24} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { color: "#FFFFFF", fontWeight: "700", fontSize: 18 },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: "#8A93A5",
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
      }}
      backBehavior="history"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarLabel: "Início",
          headerTitle: "Início",
          tabBarIcon: ({ color }) => (
            <TabIcon name="home" color={color} label="Início" />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarLabel: "Agenda",
          headerTitle: "Agenda",
          tabBarIcon: ({ color }) => (
            <TabIcon name="calendar-month" color={color} label="Agenda" />
          ),
        }}
      />
      <Tabs.Screen
        name="escalas"
        options={{
          title: "Escalas",
          tabBarLabel: "Escalas",
          headerTitle: "Escalas",
          tabBarIcon: ({ color }) => (
            <TabIcon name="clipboard-text-clock" color={color} label="Escalas" />
          ),
        }}
      />
      <Tabs.Screen
        name="igreja"
        options={{
          title: "Igreja",
          tabBarLabel: "Igreja",
          headerTitle: "Igreja",
          tabBarIcon: ({ color }) => (
            <TabIcon name="church" color={color} label="Igreja" />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarLabel: "Perfil",
          headerTitle: "Perfil",
          tabBarIcon: ({ color }) => (
            <TabIcon name="account-circle" color={color} label="Perfil" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabWrapper: { alignItems: "center", gap: 2, minWidth: 60 },
  tabLabel: { fontSize: 11, fontWeight: "600" },
});
