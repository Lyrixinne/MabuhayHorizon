import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { AuthProvider } from "../lib/auth-context";
import { CallProvider } from "../lib/call-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <CallProvider>
        <StatusBar barStyle="light-content" />
        <Stack screenOptions={{ headerShown: false }} />
      </CallProvider>
    </AuthProvider>
  );
}
