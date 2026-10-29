import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { notify } from "../../lib/dialog";
import type { Hotel } from "../../lib/types";
import { HotelCard, HotelWithPrice } from "../../components/HotelCard";
import { BookingModal } from "../../components/BookingModal";
import { Empty, Page, Spinner, Title } from "../../components/ui";
import { colors } from "../../constants/theme";

export default function Explore() {
  const [hotels, setHotels] = useState<HotelWithPrice[] | null>(null);
  const [query, setQuery] = useState("");
  const [booking, setBooking] = useState<Hotel | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("hotels")
      .select("*, rooms(price_per_night, active)")
      .eq("active", true)
      .order("rating", { ascending: false });
    if (error) return notify("Could not load hotels", friendlyError(error, "Please try again."));
    type Row = Hotel & { rooms: { price_per_night: number; active: boolean }[] };
    setHotels(
      ((data ?? []) as Row[]).map(({ rooms, ...h }) => {
        const prices = rooms.filter((r) => r.active).map((r) => Number(r.price_per_night));
        return { ...h, from_price: prices.length ? Math.min(...prices) : null };
      }),
    );
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (hotels ?? []).filter((h) => !q || `${h.name} ${h.location} ${h.near_spot}`.toLowerCase().includes(q));
  }, [hotels, query]);

  if (!hotels) return <Spinner />;

  return (
    <>
      <Page>
        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by destination (e.g. Boracay, Manila)..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
        <Title sub="Handpicked stays near top-rated Philippine tourist spots">Explore Island Destinations 🌴</Title>
        {shown.length === 0 ? <Empty text="No hotels match that destination." /> : shown.map((h) => <HotelCard key={h.id} hotel={h} onBook={setBooking} />)}
      </Page>
      <BookingModal hotel={booking} onClose={() => setBooking(null)} onBooked={() => {}} />
    </>
  );
}

const styles = StyleSheet.create({
  search: { backgroundColor: colors.navy, borderRadius: 20, paddingHorizontal: 16, marginBottom: 18 },
  searchInput: { color: "#fff", fontSize: 16, paddingVertical: 16 },
});
