import React from "react";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { homeRouteFor, useAuth } from "../../lib/auth-context";
import { AppHeader, Spinner } from "../../components/ui";
import { colors } from "../../constants/theme";

export default function GuestLayout() {
  const { profile, loading, session, browsing } = useAuth();
  if (loading) return <Spinner />;
  if (profile && profile.role !== "guest") return <Redirect href={homeRouteFor(profile.role)} />;
  if (!session && !browsing) return <Redirect href="/welcome" />;
  return (
    <View style={{ flex: 1 }}>
      <AppHeader portal="Guest" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.amber,
          tabBarInactiveTintColor: "#CBD5E1",
          tabBarStyle: { backgroundColor: colors.navy, borderTopColor: colors.navyLine },
        }}
      >
        <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={typeof color === "string" ? color : colors.amber} /> }} />
        <Tabs.Screen name="map" options={{ title: "Map", tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={typeof color === "string" ? color : colors.amber} /> }} />
        <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={typeof color === "string" ? color : colors.amber} /> }} />
        <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={typeof color === "string" ? color : colors.amber} /> }} />
        <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={typeof color === "string" ? color : colors.amber} /> }} />
      </Tabs>
    </View>
  );
}
