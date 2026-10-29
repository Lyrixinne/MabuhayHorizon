import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import { Button, Field } from "../components/ui";
import { notify } from "../lib/dialog";
import { colors } from "../constants/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (!EMAIL.test(email.trim())) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError("Your password needs at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const result = await signUp(name, email, password);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (result.needsEmailConfirmation) {
      notify("Check your email", "We sent you a link. Confirm your email, then sign in.");
      router.replace("/sign-in");
    } else {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.box}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.sub}>Book stays and message the hotel team.</Text>
            <Field label="Fullname" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
            <Field label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <Field label="Confirm Password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Sign Up" onPress={submit} loading={busy} kind="soft" style={{ borderRadius: 999, marginTop: 6 }} />
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
  error: { color: colors.red, marginBottom: 10, fontSize: 14 },
});
