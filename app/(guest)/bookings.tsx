import React, { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { friendlyError } from "../../lib/errors";
import { confirmAction, notify } from "../../lib/dialog";
import type { Booking } from "../../lib/types";
import { BookingCard } from "../../components/BookingCard";
import { BOOKING_SELECT } from "../../components/StaffBookings";
import { Button, Empty, Page, Spinner, Title } from "../../components/ui";

export default function MyBookings() {
  const router = useRouter();
  const { session, setBrowsing } = useAuth();
  const me = session?.user.id ?? null;
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("guest_id", me).order("check_in", { ascending: false });
    if (error) notify("Could not load your reservations", friendlyError(error, "Please try again."));
    else setBookings((data ?? []) as Booking[]);
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (!me) return;
      const ch = supabase
        .channel(`my-bookings-${me}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `guest_id=eq.${me}` }, () => load())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }, [load, me]),
  );

  const cancel = async (b: Booking) => {
    const ok = await confirmAction("Cancel reservation", `Cancel your stay at ${b.hotels?.name ?? "this hotel"}?`, "Cancel it");
    if (!ok) return;
    const { error } = await supabase.rpc("cancel_booking", { p_booking: b.id });
    if (error) notify("Could not cancel", friendlyError(error, "Please try again."));
    load();
  };

  if (!session) {
    return (
      <Page>
        <Title sub="Sign in to see your reservations.">My Reservations ✈️</Title>
        <Button label="Sign In" onPress={() => { setBrowsing(false); router.replace("/sign-in"); }} />
      </Page>
    );
  }
  if (!bookings) return <Spinner />;

  return (
    <Page>
      <Title sub="Manage your upcoming and active island getaways">My Reservations ✈️</Title>
      {bookings.length === 0 ? <Empty text="No reservations yet. Explore a destination and tap Book Now." /> : null}
      {bookings.map((b) => (
        <BookingCard key={b.id} booking={b} actions={b.status === "confirmed" ? [{ label: "Cancel reservation", kind: "danger", onPress: () => cancel(b) }] : undefined} />
      ))}
      <Text style={{ height: 1 }} />
    </Page>
  );
}
