import React, { useCallback, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";
import { notify } from "../../lib/dialog";
import type { Hotel, Room } from "../../lib/types";
import { Button, Card, Empty, Page, Spinner, Title } from "../../components/ui";
import { colors } from "../../constants/theme";

type HotelRow = Hotel & { rooms: Room[] };

function RoomRow({ room, onChanged }: { room: Room; onChanged: () => void }) {
  const [price, setPrice] = useState(String(room.price_per_night));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return notify("Check the price", "Enter a price above zero.");
    setSaving(true);
    const { error } = await supabase.from("rooms").update({ price_per_night: value }).eq("id", room.id);
    setSaving(false);
    if (error) return notify("Could not save", friendlyError(error, "Please try again."));
    onChanged();
  };
  const setActive = async (active: boolean) => {
    const { error } = await supabase.from("rooms").update({ active }).eq("id", room.id);
    if (error) notify("Could not update", friendlyError(error, "Please try again."));
    onChanged();
  };

  return (
    <View style={styles.room}>
      <View style={{ flex: 1 }}>
        <Text style={styles.roomName}>{room.room_number}: {room.room_type}</Text>
        <Text style={styles.meta}>Fits {room.capacity} · {room.active ? "Open for booking" : "Hidden from guests"}</Text>
      </View>
      <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.price} accessibilityLabel={`Price for ${room.room_number}`} />
      <Button label="Save" kind="soft" small onPress={save} loading={saving} />
      <Switch value={room.active} onValueChange={setActive} />
    </View>
  );
}

function AddRoom({ hotelId, onAdded }: { hotelId: string; onAdded: () => void }) {
  const [number, setNumber] = useState("");
  const [type, setType] = useState("Standard");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const p = Number(price);
    const c = Number(capacity);
    if (!number.trim()) return notify("Room number needed", "Type a room number such as Room 201.");
    if (!Number.isFinite(p) || p <= 0) return notify("Check the price", "Enter a price above zero.");
    if (!Number.isInteger(c) || c < 1) return notify("Check the capacity", "Enter how many guests the room fits.");
    setSaving(true);
    const { error } = await supabase.from("rooms").insert({ hotel_id: hotelId, room_number: number.trim(), room_type: type.trim() || "Standard", price_per_night: p, capacity: c });
    setSaving(false);
    if (error) {
      return notify("Could not add the room", error.code === "23505" ? "That room number already exists in this hotel." : friendlyError(error, "Please try again."));
    }
    setNumber("");
    setPrice("");
    onAdded();
  };

  return (
    <View style={styles.add}>
      <Text style={styles.addTitle}>Add a room</Text>
      <View style={styles.addRow}>
        <TextInput value={number} onChangeText={setNumber} placeholder="Room number" placeholderTextColor="#94A3B8" style={[styles.input, { flex: 1.2 }]} />
        <TextInput value={type} onChangeText={setType} placeholder="Type" placeholderTextColor="#94A3B8" style={[styles.input, { flex: 1.2 }]} />
      </View>
      <View style={styles.addRow}>
        <TextInput value={price} onChangeText={setPrice} placeholder="Price per night" placeholderTextColor="#94A3B8" keyboardType="numeric" style={[styles.input, { flex: 1.2 }]} />
        <TextInput value={capacity} onChangeText={setCapacity} placeholder="Guests" placeholderTextColor="#94A3B8" keyboardType="numeric" style={[styles.input, { flex: 0.8 }]} />
        <Button label="Add" kind="dark" small onPress={add} loading={saving} />
      </View>
    </View>
  );
}

export default function Hotels() {
  const [hotels, setHotels] = useState<HotelRow[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("hotels").select("*, rooms(*)").order("name");
    if (error) return notify("Could not load hotels", friendlyError(error, "Please try again."));
    setHotels(
      ((data ?? []) as HotelRow[]).map((h) => ({ ...h, rooms: [...h.rooms].sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true })) })),
    );
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setHotelActive = async (h: HotelRow, active: boolean) => {
    const { error } = await supabase.from("hotels").update({ active }).eq("id", h.id);
    if (error) notify("Could not update", friendlyError(error, "Please try again."));
    load();
  };

  if (!hotels) return <Spinner />;
  return (
    <Page>
      <Title sub="Change room prices, open or hide rooms, and add rooms">Hotels and Rooms</Title>
      {hotels.length === 0 ? <Empty text="No hotels yet." /> : null}
      {hotels.map((h) => (
        <Card key={h.id}>
          <View style={styles.hotelHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hotelName}>{h.name}</Text>
              <Text style={styles.meta}>{h.location} · Near {h.near_spot}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Switch value={h.active} onValueChange={(v) => setHotelActive(h, v)} />
              <Text style={styles.meta}>{h.active ? "Listed" : "Hidden"}</Text>
            </View>
          </View>
          {h.rooms.map((r) => <RoomRow key={r.id} room={r} onChanged={load} />)}
          <AddRoom hotelId={h.id} onAdded={load} />
        </Card>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  hotelHead: { flexDirection: "row", gap: 10, marginBottom: 8 },
  hotelName: { fontSize: 19, fontWeight: "800", color: colors.text },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  room: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line, flexWrap: "wrap" },
  roomName: { fontSize: 15, fontWeight: "700", color: colors.text },
  price: { width: 90, backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: colors.text },
  add: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  addTitle: { fontWeight: "800", color: colors.text },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, color: colors.text },
});
