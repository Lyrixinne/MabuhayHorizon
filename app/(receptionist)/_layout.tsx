import React from "react";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { homeRouteFor, useAuth } from "../../lib/auth-context";
import { AppHeader, Spinner } from "../../components/ui";
import { colors } from "../../constants/theme";

export default function ReceptionistLayout() {
  const { profile, loading, session } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/welcome" />;
  if (profile && profile.role !== "receptionist")
    return <Redirect href={homeRouteFor(profile.role)} />;
  if (!profile) return <Spinner />;
  return (
    <View style={{ flex: 1 }}>
      <AppHeader portal="Receptionist" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.amber,
          tabBarInactiveTintColor: "#CBD5E1",
          tabBarStyle: {
            backgroundColor: colors.navy,
            borderTopColor: colors.navyLine,
          },
        }}
      >
        <Tabs.Screen
          name="desk"
          options={{
            title: "Front Desk",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="notifications"
                size={size}
                color={typeof color === "number" ? colors.amber : color ?? colors.amber}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: "Reservations",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="calendar"
                size={size}
                color={typeof color === "number" ? colors.amber : color ?? colors.amber}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: "Chat",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="chatbubbles"
                size={size}
                color={typeof color === "number" ? colors.amber : color ?? colors.amber}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="settings"
                size={size}
                color={typeof color === "number" ? colors.amber : color ?? colors.amber}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
