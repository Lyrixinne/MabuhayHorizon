import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { friendlyError } from "../../lib/errors";
import { confirmAction, notify } from "../../lib/dialog";
import type { Role } from "../../lib/types";
import { Button, Card, Empty, Page, Pill, Spinner, Title } from "../../components/ui";
import { colors } from "../../constants/theme";

type UserRow = { id: string; full_name: string; email: string; role: Role };
const ROLES: Role[] = ["guest", "receptionist", "manager"];

export default function Team() {
  const { session } = useAuth();
  const me = session?.user.id;
  const [users, setUsers] = useState<UserRow[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_users");
    if (error) return notify("Could not load the team", friendlyError(error, "Please try again."));
    setUsers((data ?? []) as UserRow[]);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setRole = async (u: UserRow, role: Role) => {
    if (u.role === role) return;
    const ok = await confirmAction("Change role", `Make ${u.full_name} a ${role}?`, "Change");
    if (!ok) return;
    const { error } = await supabase.rpc("set_user_role", { p_user: u.id, p_role: role });
    if (error) notify("Could not change the role", friendlyError(error, "Please try again."));
    load();
  };

  if (!users) return <Spinner />;
  return (
    <Page>
      <Title sub="Give staff members the receptionist role so they can run the front desk">Team and Accounts</Title>
      {users.length === 0 ? <Empty text="No accounts yet." /> : null}
      {users.map((u) => (
        <Card key={u.id}>
          <View style={styles.top}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{u.full_name || "(no name)"}{u.id === me ? "  (you)" : ""}</Text>
              <Text style={styles.email}>{u.email}</Text>
            </View>
            <Pill text={u.role} tone={u.role === "manager" ? "orange" : u.role === "receptionist" ? "blue" : "gray"} />
          </View>
          {u.id !== me ? (
            <View style={styles.roles}>
              {ROLES.map((r) => (
                <Button key={r} label={r} kind={u.role === r ? "dark" : "soft"} small disabled={u.role === r} onPress={() => setRole(u, r)} />
              ))}
            </View>
          ) : null}
        </Card>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: 10, alignItems: "center" },
  name: { fontSize: 17, fontWeight: "800", color: colors.text },
  email: { color: colors.muted, marginTop: 2 },
  roles: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 },
});
