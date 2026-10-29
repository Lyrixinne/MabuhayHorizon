import { Linking, Platform } from "react-native";

// Calls open a free video/voice room that both people join with one tap.
const BASE = (process.env.EXPO_PUBLIC_CALL_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");

export function callRoomUrl(roomName: string): string {
  return `${BASE}/${roomName}`;
}

export function openCallRoom(roomName: string) {
  const url = callRoomUrl(roomName);
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
