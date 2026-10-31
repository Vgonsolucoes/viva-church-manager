import React from "react";
import { Tabs } from "expo-router";
import { ColorValue, Platform, StyleSheet, View, Text } from "react-native";
import { Home, CalendarDays, ClipboardList, Baby, Church, User } from "lucide-react-native";
import { useSessionStore } from "@/stores/session";
import { useAppTheme } from "@/theme";
import { useThemedStyles } from "@/theme";

function TabIcon({
  Icon,
  color,
  label,
  focused,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: ColorValue;
  label: string;
  focused: boolean;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles, theme);
  // React Navigation fornece o tint color como string em runtime
  const iconColor = color as string;
  return (
    <View style={styles.tabWrapper}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Icon size={22} color={iconColor} strokeWidth={focused ? 2.4 : 2} />
      </View>
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const me = useSessionStore(s => s.me);
  const modules = me?.access?.mobileModules;
  const enabled = (key: string) => modules ? modules.includes(key) : true;
  const showSchedules = modules ? modules.includes("schedules") : Boolean(me?.permissions.includes("schedules:read"));
  const theme = useAppTheme();

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
          href: enabled("home") ? undefined : null,
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
          href: enabled("agenda") ? undefined : null,
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
          href: showSchedules ? undefined : null,
          title: "Escalas",
          tabBarLabel: "Escalas",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={ClipboardList} color={color} label="Escalas" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="infantil" options={{ href: !showSchedules && enabled("kids") ? undefined : null, title: "Infantil", tabBarIcon: ({ color, focused }) => <TabIcon Icon={Baby} color={color} label="Infantil" focused={focused} /> }} />
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

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  tabWrapper: { alignItems: "center", justifyContent: "center", gap: 4, flex: 1 },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: theme.colors.borderPrimary,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 14,
    marginTop: 2,
  },
});
