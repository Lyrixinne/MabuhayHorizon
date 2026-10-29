import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";
import { friendlyError } from "./errors";
import { notify } from "./dialog";
import { openCallRoom } from "./calls";
import type { Call } from "./types";
import { Button } from "../components/ui";
import { colors, radius } from "../constants/theme";

type CallValue = {
  /** Rings the other person and opens the call room as soon as they answer. */
  startCall: (otherId: string, otherName: string) => Promise<void>;
};

const CallContext = createContext<CallValue | undefined>(undefined);

const RING_SECONDS = 45;

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const me = session?.user.id ?? null;
  const [incoming, setIncoming] = useState<{ call: Call; name: string } | null>(null);
  const [outgoing, setOutgoing] = useState<{ call: Call; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const outgoingRef = useRef<typeof outgoing>(null);
  outgoingRef.current = outgoing;

  const nameOf = useCallback(async (id: string) => {
    const { data } = await supabase.rpc("contact_directory");
    const found = (data as { id: string; full_name: string }[] | null)?.find((c) => c.id === id);
    return found?.full_name ?? "Someone";
  }, []);

  // Listen for calls to me, and for answers to calls I made.
  useEffect(() => {
    if (!me || !profile) return;
    const channel = supabase
      .channel(`calls-${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${me}` }, async (payload) => {
        const call = payload.new as Call;
        if (call.status !== "ringing") return;
        const name = await nameOf(call.caller_id);
        setIncoming({ call, name });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls" }, (payload) => {
        const call = payload.new as Call;
        // A call I received was cancelled or ended by the caller.
        setIncoming((cur) => (cur && cur.call.id === call.id && call.status !== "ringing" ? null : cur));
        // A call I made was answered.
        const out = outgoingRef.current;
        if (out && out.call.id === call.id) {
          if (call.status === "accepted") {
            setOutgoing(null);
            openCallRoom(call.room_name);
          } else if (call.status === "declined") {
            setOutgoing(null);
            notify("Call declined", `${out.name} could not take the call.`);
          } else if (call.status === "cancelled" || call.status === "ended") {
            setOutgoing(null);
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, profile, nameOf]);

  // A call nobody answers stops ringing by itself.
  useEffect(() => {
    if (!incoming) return;
    const left = RING_SECONDS * 1000 - (Date.now() - new Date(incoming.call.created_at).getTime());
    const callId = incoming.call.id;
    const t = setTimeout(async () => {
      // Expire the server-side ringing state too, so the caller does not wait
      // for a separate timeout and stale incoming calls do not remain active.
      await supabase.rpc("respond_call", { p_call: callId, p_status: "declined" });
      setIncoming((current) => (current?.call.id === callId ? null : current));
    }, Math.max(left, 0));
    return () => clearTimeout(t);
  }, [incoming]);

  useEffect(() => {
    if (!outgoing) return;
    const t = setTimeout(async () => {
      const out = outgoingRef.current;
      if (out) {
        await supabase.rpc("respond_call", { p_call: out.call.id, p_status: "cancelled" });
        setOutgoing(null);
        notify("No answer", `${out.name} did not pick up.`);
      }
    }, RING_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [outgoing]);

  const startCall = useCallback(async (otherId: string, otherName: string) => {
    if (!me || busy || outgoingRef.current) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("start_call", { p_callee: otherId });
      if (error || !data) {
        notify("Could not start the call", friendlyError(error, "Please try again."));
        return;
      }
      setOutgoing({ call: data as Call, name: otherName });
    } catch {
      notify("Could not start the call", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [me, busy]);

  const answer = async (status: "accepted" | "declined") => {
    if (!incoming) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("respond_call", { p_call: incoming.call.id, p_status: status });
    setBusy(false);
    const call = incoming.call;
    setIncoming(null);
    if (error) {
      notify("Call ended", friendlyError(error, "This call is no longer available."));
      return;
    }
    if (status === "accepted") openCallRoom(((data as Call) ?? call).room_name);
  };

  const hangUp = async () => {
    if (!outgoing) return;
    const id = outgoing.call.id;
    setOutgoing(null);
    await supabase.rpc("respond_call", { p_call: id, p_status: "cancelled" });
  };

  const value = useMemo(() => ({ startCall }), [startCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <Modal visible={!!incoming} transparent animationType="fade" onRequestClose={() => answer("declined")}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.small}>Incoming call</Text>
            <Text style={styles.name}>{incoming?.name}</Text>
            <View style={styles.row}>
              <Button label="Decline" kind="danger" onPress={() => answer("declined")} disabled={busy} style={{ flex: 1 }} />
              <Button label="Answer" kind="primary" onPress={() => answer("accepted")} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={!!outgoing} transparent animationType="fade" onRequestClose={hangUp}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.small}>Calling</Text>
            <Text style={styles.name}>{outgoing?.name}</Text>
            <Text style={styles.hint}>Waiting for them to answer…</Text>
            <Button label="Cancel call" kind="danger" onPress={hangUp} />
          </View>
        </View>
      </Modal>
    </CallContext.Provider>
  );
}

export function useCalls(): CallValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCalls must be used inside CallProvider");
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: "#fff", borderRadius: radius.lg, padding: 24, width: "100%", maxWidth: 380, gap: 10 },
  small: { color: colors.muted, fontSize: 14, textAlign: "center" },
  name: { color: colors.text, fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 14, textAlign: "center", marginBottom: 6 },
  row: { flexDirection: "row", gap: 10 },
});
