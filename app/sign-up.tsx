import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");

    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!EMAIL.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Your password needs at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const result = await signUp(name.trim(), email.trim(), password);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.needsEmailConfirmation) {
        notify(
          "Check your email",
          "We sent you a link. Confirm your email, then sign in.",
        );
        router.replace("/sign-in");
      } else {
        router.replace("/");
      }
    } catch {
      setError("Unable to create your account. Please try again.");
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
              <Text style={styles.label}>Fullname:</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                accessibilityLabel="Full name"
                returnKeyType="next"
              />

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
              <View style={styles.passwordField}>
                <TextInput value={password} onChangeText={setPassword} style={[styles.input, styles.passwordInput]} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" accessibilityLabel="Password" returnKeyType="next" />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((visible) => !visible)} style={styles.eyeButton} hitSlop={10}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={22} color="#333333" />
                </Pressable>
              </View>

              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordField}>
                <TextInput value={confirm} onChangeText={setConfirm} style={[styles.input, styles.passwordInput]} secureTextEntry={!showConfirm} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" accessibilityLabel="Confirm Password" returnKeyType="done" onSubmitEditing={submit} />
                <Pressable accessibilityRole="button" accessibilityLabel={showConfirm ? "Hide confirm password" : "Show confirm password"} onPress={() => setShowConfirm((visible) => !visible)} style={styles.eyeButton} hitSlop={10}>
                  <Feather name={showConfirm ? "eye-off" : "eye"} size={22} color="#333333" />
                </Pressable>
              </View>

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
                  {busy ? "Creating Account..." : "Sign Up"}
                </Text>
              </Pressable>

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
    paddingVertical: 20,
  },
  logo: {
    width: "100%",
    height: 240,
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 8,
  },
  form: {
    width: "100%",
  },
  label: {
    color: "#111111",
    fontSize: 23,
    fontWeight: "400",
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    width: "100%",
    minHeight: 58,
    backgroundColor: "#D9D9D9",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 18,
    color: "#111111",
    marginBottom: 22,
  },
  passwordField: { position: "relative", width: "100%", marginBottom: 22 },
  passwordInput: { marginBottom: 0, paddingRight: 58 },
  eyeButton: { position: "absolute", right: 14, top: 0, bottom: 0, width: 40, alignItems: "center", justifyContent: "center" },
  submitButton: {
    width: "100%",
    minHeight: 76,
    backgroundColor: "#D9D9D9",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 28,
  },
  submitText: {
    color: "#2868E8",
    fontSize: 25,
    fontWeight: "800",
  },
  backButton: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
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
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.65,
  },
});
