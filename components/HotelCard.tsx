import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Hotel } from "../lib/types";
import { formatMoney } from "../lib/format";
import { useCurrency } from "../lib/auth-context";
import { Button } from "./ui";
import { colors, radius } from "../constants/theme";

export type HotelWithPrice = Hotel & { from_price: number | null };

const TINTS = ["#0EA5E9", "#6366F1", "#14B8A6", "#F59E0B", "#EC4899", "#22C55E"];

export function HotelCard({ hotel, onBook }: { hotel: HotelWithPrice; onBook: (h: HotelWithPrice) => void }) {
  const currency = useCurrency();
  const tint = TINTS[Math.abs(hotel.name.length * 7) % TINTS.length];
  return (
    <View style={styles.card}>
      {hotel.image_url ? (
        <Image source={{ uri: hotel.image_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, { backgroundColor: tint, alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 54 }}>🏝️</Text>
          <Text style={styles.imageText}>{hotel.location}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.name}>{hotel.name}</Text>
          <View style={styles.rating}><Text style={styles.ratingText}>★ {Number(hotel.rating).toFixed(1)}</Text></View>
        </View>
        <Text style={styles.near}>📍 Near: {hotel.near_spot}</Text>
        <Text style={styles.desc}>{hotel.description}</Text>
        <View style={styles.footer}>
          <View>
            <Text style={styles.priceLabel}>PRICE PER NIGHT</Text>
            <Text style={styles.price}>{hotel.from_price != null ? formatMoney(hotel.from_price, currency) : "Not available"}</Text>
          </View>
          <Button label="Book Now" kind="dark" onPress={() => onBook(hotel)} disabled={hotel.from_price == null} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.lg, overflow: "hidden", marginBottom: 18, borderWidth: 1, borderColor: colors.line },
  image: { width: "100%", height: 170 },
  imageText: { color: "#fff", fontWeight: "700", marginTop: 4 },
  body: { padding: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontSize: 20, fontWeight: "800", color: colors.text, flex: 1 },
  rating: { backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  ratingText: { color: "#B45309", fontWeight: "800" },
  near: { color: colors.blue, fontWeight: "700", fontSize: 16, marginTop: 8 },
  desc: { color: colors.muted, fontSize: 15, marginTop: 6 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  priceLabel: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  price: { fontSize: 26, fontWeight: "800", color: colors.text },
});
