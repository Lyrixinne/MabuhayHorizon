import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import { Button, Field } from "../components/ui";
import { colors } from "../constants/theme";
import { isMockBackend } from "../lib/supabase";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../lib/mock/seed";

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.replace("/");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.box}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.sub}>Sign in to manage your stays.</Text>
            <Field label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Sign In" onPress={submit} loading={busy} style={{ backgroundColor: "#D8B87A", borderRadius: 999, marginTop: 6 }} />
            {isMockBackend ? (
              <View style={styles.demo}>
                <Text style={styles.demoTitle}>Demo mode (data stays on this device)</Text>
                {DEMO_ACCOUNTS.map((a) => (
                  <Text key={a.email} style={styles.demoLine} onPress={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); }}>
                    {a.role}: {a.email}
                  </Text>
                ))}
                <Text style={styles.demoLine}>Password for all: {DEMO_PASSWORD} (tap a line to fill it in)</Text>
              </View>
            ) : null}
            <Button label="Back to Options" kind="ghost" onPress={() => router.replace("/welcome")} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  box: { width: "100%", maxWidth: 440 },
  heading: { fontSize: 30, fontWeight: "800", color: "#0B2A5B" },
  sub: { color: colors.muted, fontSize: 15, marginBottom: 22, marginTop: 4 },
  demo: { backgroundColor: "#F4F1EA", borderRadius: 12, padding: 12, marginTop: 14 },
  demoTitle: { fontWeight: "700", color: "#0B2A5B", marginBottom: 6 },
  demoLine: { color: colors.muted, fontSize: 13, marginTop: 2 },
  error: { color: colors.red, marginBottom: 10, fontSize: 14 },
});
