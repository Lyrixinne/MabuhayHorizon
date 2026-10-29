import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, MAX_WIDTH, radius } from "../constants/theme";
import { useAuth } from "../lib/auth-context";

/** Top bar: app name, which portal you are in, and Logout. */
export function AppHeader({ portal }: { portal: string }) {
  const { signOut, session, setBrowsing } = useAuth();
  return (
    <SafeAreaView edges={["top"]} style={styles.headerSafe}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Mabuhay Horizon</Text>
          <Text style={styles.portal}>Portal: {portal.toUpperCase()}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => (session ? signOut() : setBrowsing(false))}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>{session ? "Logout" : "Back"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Scrolling page with a readable maximum width on large screens. */
export function Page({ children, onRefresh, refreshing }: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pageInner}>{children}</View>
    </ScrollView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: "primary" | "dark" | "soft" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, kind = "primary", disabled, loading, small, style }: ButtonProps) {
  const bg = {
    primary: colors.blue,
    dark: colors.navy,
    soft: "#E2E8F0",
    danger: colors.redSoft,
    ghost: "transparent",
  }[kind];
  const fg = kind === "soft" || kind === "ghost" ? colors.text : kind === "danger" ? colors.red : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

export function Pill({ text, tone = "blue" }: { text: string; tone?: "blue" | "green" | "orange" | "red" | "gray" }) {
  const map = {
    blue: [colors.blueSoft, colors.blue],
    green: [colors.greenSoft, colors.green],
    orange: [colors.orangeSoft, colors.orange],
    red: [colors.redSoft, colors.red],
    gray: ["#E2E8F0", colors.muted],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map[0] }]}>
      <Text style={[styles.pillText, { color: map[1] }]}>{text}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function Spinner() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.blue} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerSafe: { backgroundColor: colors.navy },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
  brand: { color: "#fff", fontSize: 22, fontWeight: "700" },
  portal: { color: colors.amber, fontSize: 14, marginTop: 2 },
  headerBtn: { backgroundColor: colors.navySoft, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm },
  headerBtnText: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { padding: 18, paddingBottom: 40 },
  pageInner: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.line },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 10 },
  button: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  buttonSmall: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontWeight: "700" },
  fieldLabel: { fontSize: 15, color: colors.text, marginBottom: 6, fontWeight: "600" },
  input: { backgroundColor: "#E5E7EB", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, alignSelf: "flex-start" },
  pillText: { fontSize: 13, fontWeight: "700" },
  empty: { padding: 28, alignItems: "center" },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.bg },
});
