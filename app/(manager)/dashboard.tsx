import React, { useCallback, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth, useCurrency } from "../../lib/auth-context";
import { friendlyError } from "../../lib/errors";
import { notify } from "../../lib/dialog";
import { formatMoney, timeAgo } from "../../lib/format";
import { Card, Empty, Page, SectionTitle, Spinner, Title } from "../../components/ui";
import { colors, radius } from "../../constants/theme";

type Stats = { active_rooms: number; occupied_rooms: number; occupancy_percent: number; month_revenue: number; arrivals_today: number };
type Log = { id: string; action: string; actor_name: string; actor_role: string; created_at: string };

export default function Dashboard() {
  const { profile, updateProfile } = useAuth();
  const currency = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Log[] | null>(null);

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([supabase.rpc("manager_stats"), supabase.rpc("recent_activity", { p_limit: 20 })]);
    if (s.error) notify("Could not load the numbers", friendlyError(s.error, "Please try again."));
    else setStats(s.data as Stats);
    if (l.error) notify("Could not load activity", friendlyError(l.error, "Please try again."));
    else setLogs((l.data ?? []) as Log[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const ch = supabase
        .channel("dashboard-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }, [load]),
  );

  if (!stats || !logs || !profile) return <Spinner />;

  return (
    <Page>
      <Title sub="Hotel performance overview and system audits">Manager Dashboard</Title>
      <View style={styles.cards}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>OCCUPANCY RATE</Text>
          <Text style={styles.statValue}>{stats.occupancy_percent}%</Text>
          <Text style={styles.statNote}>{stats.occupied_rooms} of {stats.active_rooms} rooms in use</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>REVENUE THIS MONTH</Text>
          <Text style={styles.statValue}>{formatMoney(stats.month_revenue, currency)}</Text>
          <Text style={styles.statNote}>Confirmed and completed stays</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>ARRIVALS TODAY</Text>
          <Text style={styles.statValue}>{stats.arrivals_today}</Text>
          <Text style={styles.statNote}>Guests expected</Text>
        </View>
      </View>

      <SectionTitle>System Activity Logs</SectionTitle>
      <Card>
        {logs.length === 0 ? <Empty text="No activity yet." /> : null}
        {logs.map((l, i) => (
          <View key={l.id} style={[styles.log, i > 0 && styles.logBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logAction}>{l.action}</Text>
              <Text style={styles.logBy}>By: {l.actor_name} ({l.actor_role})</Text>
            </View>
            <Text style={styles.logTime}>{timeAgo(l.created_at)}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>System Administration Settings</SectionTitle>
      <Card>
        <View style={styles.setting}>
          <Text style={styles.settingLabel}>System-wide Alerts</Text>
          <Switch value={profile.push_enabled} onValueChange={async (v) => { const r = await updateProfile({ push_enabled: v }); if (!r.ok) notify("Could not save", r.error); }} />
        </View>
        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Primary Base Currency</Text>
          <Text style={styles.settingValue}>PHP (₱)</Text>
        </View>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  stat: { flexGrow: 1, flexBasis: 220, backgroundColor: "#fff", borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.line },
  statLabel: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  statValue: { fontSize: 32, fontWeight: "800", color: colors.text, marginTop: 8 },
  statNote: { color: colors.green, fontWeight: "700", marginTop: 6, fontSize: 13 },
  log: { flexDirection: "row", gap: 10, paddingVertical: 12 },
  logBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  logAction: { fontSize: 16, fontWeight: "700", color: colors.text },
  logBy: { color: colors.muted, marginTop: 2, fontSize: 14 },
  logTime: { color: colors.muted, fontSize: 13 },
  setting: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  settingLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  settingValue: { fontSize: 16, color: colors.muted, fontWeight: "700" },
});
