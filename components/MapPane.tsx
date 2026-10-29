import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { Hotel } from "../lib/types";
import { buildMapHtml } from "../lib/map-html";

/** Android: the map runs in a small web view. */
export function MapPane({ hotels, onSelect }: { hotels: Hotel[]; onSelect: (id: string) => void }) {
  const html = useMemo(() => buildMapHtml(hotels), [hotels]);
  return (
    <View style={styles.fill}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.fill}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg?.type === "hotel" && typeof msg.id === "string") onSelect(msg.id);
          } catch {
            // ignore messages that are not ours
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
