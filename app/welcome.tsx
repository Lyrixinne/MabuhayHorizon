import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../constants/theme";
import { useAuth } from "../lib/auth-context";

export default function Welcome() {
  const router = useRouter();
  const { setBrowsing } = useAuth();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.sun}>🌅</Text>
        <Text style={styles.logo}>MABUHAY</Text>
        <Text style={styles.logoSub}>HORIZON</Text>
        <Text style={styles.tag}>Stays near the Philippines' best tourist spots</Text>

        <Pressable accessibilityRole="button" style={[styles.btn, { backgroundColor: "#D8B87A" }]} onPress={() => router.push("/sign-in")}>
          <Text style={[styles.btnText, { color: "#fff" }]}>Sign In</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={[styles.btn, { backgroundColor: "#E5E7EB" }]} onPress={() => router.push("/sign-up")}>
          <Text style={[styles.btnText, { color: "#2563EB" }]}>Create an Account</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setBrowsing(true);
            router.replace("/(guest)/explore");
          }}
        >
          <Text style={styles.guest}>Continue as Guest</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, width: "100%", maxWidth: 460, alignSelf: "center" },
  sun: { fontSize: 64 },
  logo: { fontSize: 44, fontWeight: "900", color: "#0B2A5B", letterSpacing: 2 },
  logoSub: { fontSize: 28, fontWeight: "800", color: "#0B2A5B", letterSpacing: 6, marginBottom: 8 },
  tag: { color: colors.muted, fontSize: 15, marginBottom: 48, textAlign: "center" },
  btn: { width: "100%", paddingVertical: 18, borderRadius: 999, alignItems: "center", marginBottom: 14 },
  btnText: { fontSize: 20, fontWeight: "800" },
  guest: { fontSize: 18, fontWeight: "700", color: colors.text, textDecorationLine: "underline", marginTop: 14 },
});
