import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Booking } from "../lib/types";
import { formatMoney, nightsBetween, prettyDate, statusLabel } from "../lib/format";
import { useCurrency } from "../lib/auth-context";
import { Button, Card, Pill } from "./ui";
import { colors } from "../constants/theme";

export type BookingAction = { label: string; kind?: "primary" | "dark" | "soft" | "danger"; onPress: () => void };

export function statusTone(status: string): "blue" | "green" | "orange" | "red" | "gray" {
  if (status === "confirmed") return "blue";
  if (status === "checked_in") return "orange";
  if (status === "checked_out") return "green";
  return "red";
}

export function BookingCard({ booking, showGuest, actions }: { booking: Booking; showGuest?: boolean; actions?: BookingAction[] }) {
  const currency = useCurrency();
  const nights = nightsBetween(booking.check_in, booking.check_out);
  return (
    <Card>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hotel}>{booking.hotels?.name ?? "Hotel"}</Text>
          {showGuest ? <Text style={styles.guest}>Guest: {booking.profiles?.full_name ?? "Unknown"}</Text> : null}
          <Text style={styles.meta}>Room: {booking.rooms?.room_number ?? "-"} ({booking.rooms?.room_type ?? ""})</Text>
        </View>
        <Pill text={statusLabel(booking.status)} tone={statusTone(booking.status)} />
      </View>
      <Text style={styles.meta}>
        {prettyDate(booking.check_in)} to {prettyDate(booking.check_out)} · {nights} night{nights === 1 ? "" : "s"} · {booking.guests} guest{booking.guests === 1 ? "" : "s"}
      </Text>
      <Text style={styles.total}>{formatMoney(booking.total_amount, currency)}</Text>
      {actions && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button key={a.label} label={a.label} kind={a.kind ?? "dark"} small onPress={a.onPress} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: 10, marginBottom: 6 },
  hotel: { fontSize: 18, fontWeight: "800", color: colors.text },
  guest: { color: colors.muted, fontSize: 15, marginTop: 2 },
  meta: { color: colors.muted, fontSize: 14, marginTop: 2 },
  total: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
});
