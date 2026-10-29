import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../constants/theme";

/** Shown until the two Supabase keys are added to .env. */
export function SetupScreen() {
  return (
    <ScrollView contentContainerStyle={styles.wrap} style={{ backgroundColor: colors.navy }}>
      <View style={styles.card}>
        <Text style={styles.title}>Mabuhay Horizon</Text>
        <Text style={styles.text}>The app is not connected to its database yet.</Text>
        <Text style={styles.step}>1. Create a Supabase project and run supabase/migrations/20261101_mabuhay_schema.sql in the SQL Editor.</Text>
        <Text style={styles.step}>2. Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text>
        <Text style={styles.step}>3. Restart with: npx expo start --clear</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: radius.lg, padding: 24, width: "100%", maxWidth: 520, gap: 10 },
  title: { fontSize: 26, fontWeight: "800", color: colors.navy },
  text: { fontSize: 16, color: colors.text },
  step: { fontSize: 15, color: colors.muted, lineHeight: 22 },
});
