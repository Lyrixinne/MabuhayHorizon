import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
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

    try {
      const result = await signIn(email.trim(), password);

      if (!result.ok) {
        setError(result.error);
      } else {
        router.replace("/");
      }
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Image
              source={require("../assets/images/Mabuhay Horizon Logo.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Mabuhay Horizon logo"
            />

            <View style={styles.form}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                accessibilityLabel="Email Address"
                returnKeyType="next"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                accessibilityLabel="Password"
                returnKeyType="done"
                onSubmitEditing={submit}
              />

              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={submit}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && !busy && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Text style={styles.submitText}>
                  {busy ? "Signing In..." : "Sign In"}
                </Text>
              </Pressable>

              {isMockBackend ? (
                <View style={styles.demo}>
                  <Text style={styles.demoTitle}>
                    Demo mode (data stays on this device)
                  </Text>

                  {DEMO_ACCOUNTS.map((account) => (
                    <Text
                      key={account.email}
                      style={styles.demoLine}
                      onPress={() => {
                        setEmail(account.email);
                        setPassword(DEMO_PASSWORD);
                        setError("");
                      }}
                    >
                      {account.role}: {account.email}
                    </Text>
                  ))}

                  <Text style={styles.demoLine}>
                    Password for all: {DEMO_PASSWORD} (tap an account to fill it
                    in)
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace("/welcome")}
                style={styles.backButton}
              >
                <Text style={styles.backText}>Back to Options</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  logo: {
    width: "100%",
    height: 270,
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 16,
  },
  form: {
    width: "100%",
  },
  label: {
    color: "#111111",
    fontSize: 23,
    fontWeight: "400",
    marginBottom: 12,
    marginLeft: 4,
  },
  input: {
    width: "100%",
    minHeight: 64,
    backgroundColor: "#D9D9D9",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 18,
    color: "#111111",
    marginBottom: 26,
  },
  submitButton: {
    width: "100%",
    minHeight: 76,
    backgroundColor: "#E5CFA8",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 48,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },
  backButton: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
  },
  backText: {
    color: "#061421",
    fontSize: 22,
    fontWeight: "400",
    textAlign: "center",
  },
  error: {
    color: colors.red,
    fontSize: 14,
    marginTop: -12,
    marginBottom: 8,
  },
  demo: {
    backgroundColor: "#F4F1EA",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  demoTitle: {
    fontWeight: "700",
    color: "#0B2A5B",
    marginBottom: 6,
  },
  demoLine: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.65,
  },
});
