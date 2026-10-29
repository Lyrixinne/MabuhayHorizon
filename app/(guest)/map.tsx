import React, { useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
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
      let mounted = true;

      supabase
        .from("hotels")
        .select("*")
        .eq("active", true)
        .then(({ data, error }) => {
          if (!mounted) return;

          if (error) {
            notify(
              "Could not load the map",
              friendlyError(error, "Please try again."),
            );
          } else {
            setHotels((data ?? []) as Hotel[]);
          }
        });

      return () => {
        mounted = false;
      };
    }, []),
  );

  const select = useCallback(
    (id: string) => {
      const hotel = (hotels ?? []).find((item) => item.id === id);

      if (hotel) {
        setSelected(hotel);
      }
    },
    [hotels],
  );

  if (!hotels) {
    return <Spinner />;
  }

  return (
    <View style={styles.container}>
      <MapPane hotels={hotels} onSelect={select} />

      {selected ? (
        <View style={styles.panel}>
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator={false}
          >
            {selected.image_url ? (
              <Image
                source={{ uri: selected.image_url }}
                style={styles.hotelImage}
                resizeMode="cover"
                onError={() => {
                  // Keep the hotel details visible if the image URL is invalid.
                }}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderEmoji}>🏝️</Text>
                <Text style={styles.placeholderText}>
                  Hotel photo unavailable
                </Text>
              </View>
            )}

            <Text style={styles.name}>{selected.name}</Text>

            <Text style={styles.near}>
              📍 {selected.location}
              {selected.near_spot ? ` · Near ${selected.near_spot}` : ""}
            </Text>

            {selected.description ? (
              <Text style={styles.description}>{selected.description}</Text>
            ) : null}

            <View style={styles.actions}>
              <Button
                label="Book"
                kind="dark"
                small
                onPress={() => setBooking(selected)}
              />

              <Button
                label="Close"
                kind="ghost"
                small
                onPress={() => setSelected(null)}
              />
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Tap a hotel pin to view its picture
          </Text>
        </View>
      )}

      <BookingModal
        hotel={booking}
        onClose={() => setBooking(null)}
        onBooked={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  panel: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    maxHeight: "65%",
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  panelScroll: {
    flexGrow: 0,
  },
  panelContent: {
    padding: 14,
  },
  hotelImage: {
    width: "100%",
    height: 190,
    borderRadius: radius.md,
    backgroundColor: "#e2e8f0",
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: "100%",
    height: 150,
    borderRadius: radius.md,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  placeholderEmoji: {
    fontSize: 42,
  },
  placeholderText: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
  },
  name: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
  },
  near: {
    color: colors.blue,
    fontSize: 13,
    marginTop: 5,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  hint: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hintText: {
    color: "#fff",
    fontSize: 13,
  },
});
