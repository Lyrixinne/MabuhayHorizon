import React, { useCallback, useEffect, useState } from "react";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth, useCurrency } from "../lib/auth-context";
import { friendlyError } from "../lib/errors";
import { notify } from "../lib/dialog";
import { addDays, formatMoney, prettyDate, toIsoDate } from "../lib/format";
import type { Hotel, Room } from "../lib/types";
import { Button, Empty } from "./ui";
import { colors, radius } from "../constants/theme";

type Props = { hotel: Hotel | null; onClose: () => void; onBooked: () => void };

function formatMonthDayYear(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return month && day && year ? `${month}/${day}/${year}` : isoDate;
}

function Stepper({ label, value, onMinus, onPlus, minusDisabled, plusDisabled }: { label: string; value: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} minus`} disabled={minusDisabled} onPress={onMinus} style={[styles.stepBtn, minusDisabled && { opacity: 0.35 }]}><Text style={styles.stepBtnText}>−</Text></Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} plus`} disabled={plusDisabled} onPress={onPlus} style={[styles.stepBtn, plusDisabled && { opacity: 0.35 }]}><Text style={styles.stepBtnText}>+</Text></Pressable>
      </View>
    </View>
  );
}

export function BookingModal({ hotel, onClose, onBooked }: Props) {
  const router = useRouter();
  const { session, profile, setBrowsing } = useAuth();
  const currency = useCurrency();
  const today = toIsoDate(new Date());
  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nights, setNights] = useState(1);
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const checkOut = addDays(checkIn, nights);
  const canBook = !!session && profile?.role === "guest";

  const loadRooms = useCallback(async () => {
    if (!hotel) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("available_rooms", {
      p_hotel: hotel.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: guests,
    });
    setLoading(false);
    if (error) {
      notify("Could not load rooms", friendlyError(error, "Please try again."));
      return;
    }
    const list = (data ?? []) as Room[];
    setRooms(list);
    setRoomId((cur) => (cur && list.some((r) => r.id === cur) ? cur : list[0]?.id ?? null));
  }, [hotel, checkIn, checkOut, guests]);

  useEffect(() => {
    if (hotel) loadRooms();
  }, [hotel, loadRooms]);

  useEffect(() => {
    if (hotel) {
      setCheckIn(addDays(toIsoDate(new Date()), 1));
      setNights(1);
      setGuests(2);
      setRoomId(null);
    }
  }, [hotel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = rooms.find((r) => r.id === roomId) ?? null;
  const total = room ? room.price_per_night * nights : 0;

  const confirm = async () => {
    if (!room) return;
    setSaving(true);
    const { error } = await supabase.rpc("create_booking", {
      p_room: room.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: guests,
    });
    setSaving(false);
    if (error) {
      notify("Could not book", friendlyError(error, "Please try again."));
      loadRooms();
      return;
    }
    notify("Reservation confirmed", `${hotel?.name}, ${prettyDate(checkIn)} to ${prettyDate(checkOut)}.`);
    onBooked();
    onClose();
  };

  return (
    <Modal visible={!!hotel} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={2}>{hotel?.name}</Text>
            <Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.close}>Close</Text></Pressable>
          </View>
          {!canBook ? (
            <View style={{ padding: 8 }}>
              <Text style={styles.msg}>
                {session ? "Only guest accounts can make reservations." : "Please sign in or create an account to book a room."}
              </Text>
              {!session ? (
                <Button label="Sign In" onPress={() => { onClose(); setBrowsing(false); router.replace("/sign-in"); }} />
              ) : null}
            </View>
          ) : (
            <ScrollView>
              <Text style={styles.stepLabel}>Check-in date</Text>
              {Platform.OS === "web" ? (
                <View style={styles.dateButton}>
                  <Text style={styles.dateButtonText}>▦  {formatMonthDayYear(checkIn)}</Text>
                  {React.createElement("input", {
                    type: "date",
                    value: checkIn,
                    min: today,
                    "aria-label": "Check-in date",
                    onChange: (event: { target: { value: string } }) => {
                      const selectedIso = event.target.value;
                      if (selectedIso && selectedIso >= today) setCheckIn(selectedIso);
                    },
                    style: {
                      border: "none",
                      background: "transparent",
                      color: colors.text,
                      font: "inherit",
                      fontSize: 15,
                      minWidth: 0,
                      maxWidth: "100%",
                      cursor: "pointer",
                    },
                  })}
                </View>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Choose check-in date, currently ${formatMonthDayYear(checkIn)}`}
                    onPress={() => setShowDatePicker(true)}
                    style={styles.dateButton}
                  >
                    <Text style={styles.dateButtonText}>▦  {formatMonthDayYear(checkIn)}</Text>
                    <Text style={styles.dateButtonAction}>Choose date</Text>
                  </Pressable>
                  {showDatePicker ? (
                    <DateTimePicker
                      value={new Date(`${checkIn}T12:00:00`)}
                      mode="date"
                      display={Platform.OS === "android" ? "calendar" : "inline"}
                      minimumDate={new Date(`${today}T00:00:00`)}
                      onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                        if (Platform.OS === "android") setShowDatePicker(false);
                        if (event.type === "dismissed" || !selectedDate) return;
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                        const day = String(selectedDate.getDate()).padStart(2, "0");
                        const selectedIso = `${year}-${month}-${day}`;
                        setCheckIn(selectedIso < today ? today : selectedIso);
                      }}
                    />
                  ) : null}
                  {Platform.OS === "ios" && showDatePicker ? (
                    <Pressable onPress={() => setShowDatePicker(false)} style={styles.dateDoneButton}>
                      <Text style={styles.dateDoneText}>Done</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
              <Stepper label="Nights" value={String(nights)} onMinus={() => setNights((n) => Math.max(1, n - 1))} onPlus={() => setNights((n) => Math.min(30, n + 1))} minusDisabled={nights <= 1} plusDisabled={nights >= 30} />
              <Stepper label="Guests" value={String(guests)} onMinus={() => setGuests((g) => Math.max(1, g - 1))} onPlus={() => setGuests((g) => Math.min(10, g + 1))} minusDisabled={guests <= 1} plusDisabled={guests >= 10} />
              <Text style={styles.sub}>Check-out: {prettyDate(checkOut)}</Text>

              <Text style={styles.section}>Available rooms</Text>
              {loading ? (
                <ActivityIndicator color={colors.blue} style={{ margin: 20 }} />
              ) : rooms.length === 0 ? (
                <Empty text="No rooms are free for those dates and guests. Try other dates." />
              ) : (
                rooms.map((r) => (
                  <Pressable key={r.id} onPress={() => setRoomId(r.id)} style={[styles.room, roomId === r.id && styles.roomOn]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomName}>{r.room_number}: {r.room_type}</Text>
                      <Text style={styles.roomMeta}>Fits {r.capacity} guests</Text>
                    </View>
                    <Text style={styles.roomPrice}>{formatMoney(r.price_per_night, currency)}<Text style={styles.roomMeta}> / night</Text></Text>
                  </Pressable>
                ))
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.total}>{formatMoney(total, currency)}</Text>
              </View>
              <Button label="Confirm Reservation" onPress={confirm} loading={saving} disabled={!room} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: "100%", maxWidth: 560, maxHeight: "92%" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, flex: 1 },
  close: { color: colors.blue, fontSize: 16, fontWeight: "700" },
  msg: { fontSize: 16, color: colors.text, marginBottom: 16 },
  dateButton: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: "#F8FAFC", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 12 },
  dateButtonText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  dateButtonAction: { color: colors.blue, fontSize: 14, fontWeight: "700" },
  dateDoneButton: { alignSelf: "flex-end", paddingHorizontal: 18, paddingVertical: 10 },
  dateDoneText: { color: colors.blue, fontSize: 16, fontWeight: "700" },
  stepRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  stepLabel: { fontSize: 16, color: colors.text, fontWeight: "600", flex: 1 },
  stepControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: -2 },
  stepValue: { minWidth: 26, textAlign: "center", fontSize: 18, fontWeight: "700", color: colors.text },
  sub: { color: colors.muted, marginBottom: 6 },
  section: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 10, marginBottom: 8 },
  room: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line, marginBottom: 8 },
  roomOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  roomName: { fontSize: 16, fontWeight: "700", color: colors.text },
  roomMeta: { fontSize: 13, color: colors.muted, fontWeight: "400" },
  roomPrice: { fontSize: 16, fontWeight: "800", color: colors.text },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 14 },
  totalLabel: { fontSize: 16, color: colors.muted },
  total: { fontSize: 26, fontWeight: "800", color: colors.text },
});
