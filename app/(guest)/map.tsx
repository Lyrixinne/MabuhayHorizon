import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { notify } from "../../lib/dialog";
import type { Hotel } from "../../lib/types";
import { MapPane } from "../../components/MapPane";
import { BookingModal } from "../../components/BookingModal";
import { Button, Spinner } from "../../components/ui";
import { colors, radius } from "../../constants/theme";

export default function MapScreen() {
  const [hotels, setHotels] = useState<Hotel[] | null>(null);
  const [selected, setSelected] = useState<Hotel | null>(null);
  const [booking, setBooking] = useState<Hotel | null>(null);

  useFocusEffect(
    useCallback(() => {
      supabase.from("hotels").select("*").eq("active", true).then(({ data, error }) => {
        if (error) notify("Could not load the map", friendlyError(error, "Please try again."));
        else setHotels((data ?? []) as Hotel[]);
      });
    }, []),
  );

  const select = useCallback((id: string) => setSelected((cur) => (hotels ?? []).find((h) => h.id === id) ?? cur), [hotels]);

  if (!hotels) return <Spinner />;
  return (
    <View style={{ flex: 1 }}>
      <MapPane hotels={hotels} onSelect={select} />
      {selected ? (
        <View style={styles.panel}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{selected.name}</Text>
            <Text style={styles.near}>📍 {selected.location} · Near {selected.near_spot}</Text>
          </View>
          <Button label="Book" kind="dark" small onPress={() => setBooking(selected)} />
        </View>
      ) : (
        <View style={styles.hint}><Text style={styles.hintText}>Tap a pin to see the hotel</Text></View>
      )}
      <BookingModal hotel={booking} onClose={() => setBooking(null)} onBooked={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: "#fff", borderRadius: radius.lg, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.line },
  name: { fontSize: 17, fontWeight: "800", color: colors.text },
  near: { color: colors.blue, fontSize: 13, marginTop: 2 },
  hint: { position: "absolute", bottom: 12, alignSelf: "center", backgroundColor: "rgba(15,23,42,0.85)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  hintText: { color: "#fff", fontSize: 13 },
});
