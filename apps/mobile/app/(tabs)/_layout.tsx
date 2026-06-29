import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1d4ed8",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e5e7eb",
        },
        headerStyle: { backgroundColor: "#1d4ed8" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarLabel: "Inicio",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Mis Envíos",
          tabBarLabel: "Envíos",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🚚</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Mi Perfil",
          tabBarLabel: "Perfil",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
