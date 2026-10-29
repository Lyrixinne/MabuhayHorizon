import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/theme";
import { useAuth } from "../lib/auth-context";

export default function Welcome() {
  const router = useRouter();
  const { setBrowsing } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wrap}>
          <Image
            source={require("../assets/images/Mabuhay Horizon Logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Mabuhay Horizon logo"
          />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/sign-in")}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.createButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/sign-up")}
            >
              <Text style={styles.createText}>Create an Account</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.guestButton}
              onPress={() => {
                setBrowsing(true);
                router.replace("/(guest)/explore");
              }}
            >
              <Text style={styles.guestText}>Continue as Guest</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  wrap: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: 300,
    maxWidth: 400,
    marginBottom: 20,
  },
  actions: {
    width: "100%",
    gap: 18,
    alignItems: "stretch",
  },
  signInButton: {
    minHeight: 74,
    backgroundColor: "#E5CFA8",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },
  createButton: {
    minHeight: 74,
    backgroundColor: "#D9D9D9",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  createText: {
    color: "#2868E8",
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
  },
  guestButton: {
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  guestText: {
    color: "#061421",
    fontSize: 22,
    fontWeight: "800",
    textDecorationLine: "underline",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
  },
});
