import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/errors";
import { confirmAction, notify } from "../lib/dialog";
import { useCalls } from "../lib/call-context";
import type { Booking } from "../lib/types";
import { BookingCard, BookingAction } from "./BookingCard";
import { Empty, Page, Spinner, Title } from "./ui";
import { colors, radius } from "../constants/theme";

export const BOOKING_SELECT = "*, rooms(room_number, room_type), hotels(name), profiles(full_name)";

type Filter = "upcoming" | "inhouse" | "history" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "inhouse", label: "In-house" },
  { key: "history", label: "History" },
  { key: "all", label: "All" },
];

/** Staff actions shared by the desk and the bookings tabs. */
export function useStaffBookingActions(reload: () => void) {
  const { startCall } = useCalls();
  const changeStatus = async (b: Booking, status: "checked_in" | "checked_out" | "cancelled") => {
    if (status === "cancelled") {
      const ok = await confirmAction("Cancel reservation", `Cancel ${b.profiles?.full_name ?? "this guest"}'s reservation?`, "Cancel it");
      if (!ok) return;
    }
    const { error } = await supabase.rpc("set_booking_status", { p_booking: b.id, p_status: status });
    if (error) notify("Could not update", friendlyError(error, "Please try again."));
    reload();
  };
  const actionsFor = (b: Booking): BookingAction[] => {
    const list: BookingAction[] = [];
    if (b.status === "confirmed") {
      list.push({ label: "Check in", onPress: () => changeStatus(b, "checked_in") });
      list.push({ label: "Cancel", kind: "danger", onPress: () => changeStatus(b, "cancelled") });
    }
    if (b.status === "checked_in") list.push({ label: "Check out", onPress: () => changeStatus(b, "checked_out") });
    list.push({ label: "📞 Call guest", kind: "soft", onPress: () => startCall(b.guest_id, b.profiles?.full_name ?? "Guest") });
    return list;
  };
  return { actionsFor };
}

export function StaffBookings({ title }: { title: string }) {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).order("check_in", { ascending: true }).limit(300);
    if (error) notify("Could not load reservations", friendlyError(error, "Please try again."));
    else setBookings((data ?? []) as Booking[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const ch = supabase
        .channel("staff-bookings")
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }, [load]),
  );

  const { actionsFor } = useStaffBookingActions(load);

  if (!bookings) return <Spinner />;
  const shown = bookings.filter((b) =>
    filter === "all" ? true
      : filter === "upcoming" ? b.status === "confirmed"
      : filter === "inhouse" ? b.status === "checked_in"
      : b.status === "checked_out" || b.status === "cancelled",
  );

  return (
    <Page>
      <Title sub="Everything booked across the hotels">{title}</Title>
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipOn]}>
            <Text style={[styles.chipText, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      {shown.length === 0 ? <Empty text="Nothing here." /> : shown.map((b) => <BookingCard key={b.id} booking={b} showGuest actions={actionsFor(b)} />)}
    </Page>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: "#E2E8F0" },
  chipOn: { backgroundColor: colors.navy },
  chipText: { fontWeight: "700", color: colors.text, fontSize: 14 },
});
