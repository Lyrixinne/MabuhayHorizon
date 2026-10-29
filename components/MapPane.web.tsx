import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import type { Hotel } from "../lib/types";
import { buildMapHtml } from "../lib/map-html";

/** Web: the same map inside an iframe. */
export function MapPane({ hotels, onSelect }: { hotels: Hotel[]; onSelect: (id: string) => void }) {
  const html = useMemo(() => buildMapHtml(hotels), [hotels]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const msg = typeof e.data === "string" ? JSON.parse(e.data) : null;
        if (msg?.type === "hotel" && typeof msg.id === "string") onSelect(msg.id);
      } catch {
        // ignore messages that are not ours
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSelect]);

  return (
    <View style={{ flex: 1 }}>
      {React.createElement("iframe", {
        title: "Hotel map",
        srcDoc: html,
        style: { border: 0, width: "100%", height: "100%" },
        sandbox: "allow-scripts",
      })}
    </View>
  );
}
