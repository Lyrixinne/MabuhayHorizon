import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { notify } from "../../lib/dialog";
import { toIsoDate } from "../../lib/format";
import type { Booking, Room } from "../../lib/types";
import { BookingCard } from "../../components/BookingCard";
import { BOOKING_SELECT, useStaffBookingActions } from "../../components/StaffBookings";
import { Button, Card, Empty, Page, Pill, SectionTitle, Spinner, Title } from "../../components/ui";
import { colors } from "../../constants/theme";

type RoomRow = Room & { hotels: { name: string } | null };

export default function Desk() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);

  const load = useCallback(async () => {
    const today = toIsoDate(new Date());
    const [b, r] = await Promise.all([
      supabase.from("bookings").select(BOOKING_SELECT).or(`status.eq.checked_in,and(status.eq.confirmed,check_in.lte.${today})`).order("check_in"),
      supabase.from("rooms").select("*, hotels(name)").order("room_number"),
    ]);
    if (b.error) notify("Could not load arrivals", friendlyError(b.error, "Please try again."));
    else setBookings((b.data ?? []) as Booking[]);
    if (r.error) notify("Could not load rooms", friendlyError(r.error, "Please try again."));
    else setRooms((r.data ?? []) as RoomRow[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const ch = supabase
        .channel("desk-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }, [load]),
  );

  const { actionsFor } = useStaffBookingActions(load);

  const toggle = async (room: RoomRow) => {
    const { error } = await supabase.rpc("toggle_housekeeping", { p_room: room.id });
    if (error) notify("Could not update the room", friendlyError(error, "Please try again."));
    load();
  };

  if (!bookings || !rooms) return <Spinner />;
  const arrivals = bookings.filter((b) => b.status === "confirmed");
  const inHouse = bookings.filter((b) => b.status === "checked_in");

  return (
    <Page>
      <Title sub="Manage arrival queues and room readiness">Front Desk 🔔</Title>

      <SectionTitle>Today's Guest Arrivals</SectionTitle>
      {arrivals.length === 0 ? <Empty text="No arrivals waiting." /> : arrivals.map((b) => <BookingCard key={b.id} booking={b} showGuest actions={actionsFor(b)} />)}

      <SectionTitle>Guests In-house</SectionTitle>
      {inHouse.length === 0 ? <Empty text="Nobody is checked in." /> : inHouse.map((b) => <BookingCard key={b.id} booking={b} showGuest actions={actionsFor(b)} />)}

      <SectionTitle>Housekeeping & Room Status</SectionTitle>
      <Card>
        {rooms.map((r, i) => (
          <View key={r.id} style={[styles.roomRow, i > 0 && styles.roomBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomHotel}>{r.hotels?.name}</Text>
              <Text style={styles.roomMeta}>{r.room_number} · {r.room_type}</Text>
              <View style={{ marginTop: 6 }}>
                <Pill text={`Housekeeping Status: ${r.housekeeping === "clean" ? "Clean" : "Dirty"}`} tone={r.housekeeping === "clean" ? "green" : "red"} />
              </View>
            </View>
            <Button label="Toggle Clean" kind="soft" small onPress={() => toggle(r)} />
          </View>
        ))}
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  roomRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  roomBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  roomHotel: { fontSize: 17, fontWeight: "800", color: colors.text },
  roomMeta: { color: colors.muted, fontSize: 14, marginTop: 2 },
});
