import type { Currency } from "./types";

// Prices are stored in pesos. USD is shown as an approximation.
const PHP_PER_USD = 58;

export function formatMoney(amountPhp: number, currency: Currency = "PHP"): string {
  if (currency === "USD") {
    return `$${(amountPhp / PHP_PER_USD).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `₱${Number(amountPhp).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toIsoDate(date);
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function nightsBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function statusLabel(status: string): string {
  switch (status) {
    case "confirmed": return "Confirmed";
    case "checked_in": return "Checked-In";
    case "checked_out": return "Checked-Out";
    case "cancelled": return "Cancelled";
    default: return status;
  }
}
