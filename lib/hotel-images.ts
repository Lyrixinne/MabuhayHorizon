import type { Hotel } from "./types";

/**
 * A display-only fallback for hotels whose database image_url is empty.
 * Keep real uploaded hotel photos as the source of truth whenever present.
 */
const PHOTO_BY_DESTINATION: Array<{ match: RegExp; url: string }> = [
  {
    match: /boracay|beach|island/i,
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85",
  },
  {
    match: /makati|manila|city|skyline/i,
    url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85",
  },
  {
    match: /siargao|surf|cloud 9|general luna/i,
    url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=85",
  },
  {
    match: /baguio|mountain|pine/i,
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=85",
  },
  {
    match: /cebu|moalboal|bay|waterfall/i,
    url: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=85",
  },
  {
    match: /el nido|palawan|lagoon/i,
    url: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=85",
  },
];

const DEFAULT_HOTEL_PHOTO =
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=85";

export function hotelImageUrl(hotel: Pick<Hotel, "name" | "location" | "near_spot" | "image_url">): string {
  if (hotel.image_url?.trim()) return hotel.image_url.trim();

  const description = [hotel.name, hotel.location, hotel.near_spot].filter(Boolean).join(" ");
  return PHOTO_BY_DESTINATION.find((entry) => entry.match.test(description))?.url ?? DEFAULT_HOTEL_PHOTO;
}
