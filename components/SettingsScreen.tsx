import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { isMockBackend, supabase } from "../lib/supabase";
import { resetMockData } from "../lib/mock/client";
import { useAuth } from "../lib/auth-context";
import { friendlyError } from "../lib/errors";
import { confirmAction, notify } from "../lib/dialog";
import { Button, Card, Field, Page, Pill, Title } from "./ui";
import { colors, radius } from "../constants/theme";

const POLICY = [
  "What we keep: your name, email, phone number (if you add it), your reservations, and your chat messages with the hotel team.",
  "Why: to run your bookings, let you contact the hotel, and let staff manage arrivals and rooms.",
  "Who can see it: you, and the hotel's receptionists and manager. Guests cannot see each other's details.",
  "Calls: when you call, you and the other person join a video or voice room on a public service. Do not share private information in a call you did not start.",
  "Your choices: you can edit your details here, change your password, and ask the manager to remove your account.",
];

export function SettingsScreen({ roleLabel }: { roleLabel: string }) {
  const router = useRouter();
  const { profile, session, updateProfile, signOut, setBrowsing } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  if (!session || !profile) {
    return (
      <Page>
        <Title sub="Sign in to manage your profile and preferences.">Traveler Settings</Title>
        <Button label="Sign In" onPress={() => { setBrowsing(false); router.replace("/sign-in"); }} />
      </Page>
    );
  }

  const saveProfile = async () => {
    if (name.trim().length < 2) return notify("Name needed", "Please enter your full name.");
    setSaving(true);
    const r = await updateProfile({ full_name: name.trim(), phone: phone.trim() || null });
    setSaving(false);
    if (!r.ok) return notify("Could not save", r.error);
    setEditing(false);
  };

  const changePassword = async () => {
    if (pw.length < 8) return notify("Password too short", "Use at least 8 characters.");
    if (pw !== pw2) return notify("Passwords differ", "The two passwords do not match.");
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) return notify("Could not change password", friendlyError(error, "Please try again."));
    setPwOpen(false);
    setPw("");
    setPw2("");
    notify("Password changed", "Use your new password next time you sign in.");
  };

  return (
    <Page>
      <Title sub="Manage your profile, preferences, and notifications">{roleLabel} Settings</Title>

      <Card>
        <Text style={styles.cardTitle}>Profile Information</Text>
        {editing ? (
          <>
            <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label="Save" onPress={saveProfile} loading={saving} style={{ flex: 1 }} />
              <Button label="Cancel" kind="soft" onPress={() => { setEditing(false); setName(profile.full_name); setPhone(profile.phone ?? ""); }} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.line}>Name: {profile.full_name}</Text>
            <Text style={styles.line}>Email: {profile.email}</Text>
            {profile.phone ? <Text style={styles.line}>Phone: {profile.phone}</Text> : null}
            <View style={{ marginTop: 6, marginBottom: 12 }}><Pill text={profile.role} tone="gray" /></View>
            <Button label="Edit Profile Details" kind="soft" onPress={() => setEditing(true)} />
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Preferences</Text>
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>Push Notifications</Text>
          <Switch value={profile.push_enabled} onValueChange={async (v) => { const r = await updateProfile({ push_enabled: v }); if (!r.ok) notify("Could not save", r.error); }} />
        </View>
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>Preferred Currency</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["PHP", "USD"] as const).map((c) => (
              <Pressable key={c} onPress={async () => { const r = await updateProfile({ currency: c }); if (!r.ok) notify("Could not save", r.error); }} style={[styles.curBtn, profile.currency === c && styles.curBtnOn]}>
                <Text style={[styles.curText, profile.currency === c && { color: "#fff" }]}>{c === "PHP" ? "PHP (₱)" : "USD ($)"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.note}>Prices are stored in pesos. Dollar prices are approximate.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Support & Security</Text>
        <Button label="Change Password" kind="soft" onPress={() => setPwOpen(true)} style={{ marginBottom: 10 }} />
        <Button label="Privacy Policy & Data Terms" kind="danger" onPress={() => setPolicyOpen(true)} style={{ marginBottom: 10 }} />
        <Button label="Logout" kind="dark" onPress={signOut} />
        {isMockBackend ? (
          <Button
            label="Reset demo data"
            kind="soft"
            style={{ marginTop: 10 }}
            onPress={async () => {
              if (await confirmAction("Reset demo data?", "This puts all demo hotels, bookings and chats back to the start and signs you out.", "Reset")) await resetMockData();
            }}
          />
        ) : null}
      </Card>

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.cardTitle}>Change Password</Text>
            <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry />
            <Field label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label="Save" onPress={changePassword} loading={pwBusy} style={{ flex: 1 }} />
              <Button label="Cancel" kind="soft" onPress={() => setPwOpen(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={policyOpen} transparent animationType="fade" onRequestClose={() => setPolicyOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.cardTitle}>Privacy Policy & Data Terms</Text>
            {POLICY.map((p) => (
              <Text key={p} style={styles.policy}>• {p}</Text>
            ))}
            <Button label="Close" onPress={() => setPolicyOpen(false)} />
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 19, fontWeight: "800", color: colors.text, marginBottom: 12 },
  line: { fontSize: 16, color: colors.text, marginBottom: 6 },
  prefRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  prefLabel: { fontSize: 16, color: colors.text },
  curBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.blueSoft },
  curBtnOn: { backgroundColor: colors.blue },
  curText: { color: colors.blue, fontWeight: "700", fontSize: 14 },
  note: { color: colors.muted, fontSize: 12, marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#fff", borderRadius: radius.lg, padding: 22, width: "100%", maxWidth: 460, gap: 8 },
  policy: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 4 },
});
