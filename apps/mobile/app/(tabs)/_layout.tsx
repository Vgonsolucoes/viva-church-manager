import React from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View, Text } from "react-native";
import { Home, CalendarDays, ClipboardList, Church, User } from "lucide-react-native";
import { theme } from "@/theme";

function TabIcon({
  Icon,
  color,
  label,
  focused,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: string;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabWrapper}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
      </View>
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary500,
        tabBarInactiveTintColor: theme.colors.foregroundMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.borderSubtle,
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingHorizontal: theme.spacing.sm,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
      backBehavior="history"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarLabel: "Início",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Home} color={color} label="Início" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarLabel: "Agenda",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={CalendarDays} color={color} label="Agenda" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="escalas"
        options={{
          title: "Escalas",
          tabBarLabel: "Escalas",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={ClipboardList} color={color} label="Escalas" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="igreja"
        options={{
          title: "Igreja",
          tabBarLabel: "Igreja",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Church} color={color} label="Igreja" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarLabel: "Perfil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={User} color={color} label="Perfil" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabWrapper: { alignItems: "center", justifyContent: "center", gap: 4, flex: 1 },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(23,107,255,0.12)",
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 14,
    marginTop: 2,
  },
});
