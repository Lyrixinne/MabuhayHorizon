// Starting demo data for the on-device mock backend.
export type MockState = {
  auth_users: { id: string; email: string; password: string; full_name: string }[];
  profiles: Record<string, any>[];
  hotels: Record<string, any>[];
  rooms: Record<string, any>[];
  bookings: Record<string, any>[];
  activity_logs: Record<string, any>[];
  conversations: Record<string, any>[];
  messages: Record<string, any>[];
  calls: Record<string, any>[];
};

export const DEMO_PASSWORD = "demo1234";
export const DEMO_ACCOUNTS = [
  { role: "Guest", email: "guest@mabuhay.demo" },
  { role: "Receptionist", email: "reception@mabuhay.demo" },
  { role: "Manager", email: "manager@mabuhay.demo" },
];

let counter = 0;
const id = (prefix: string) => `${prefix}-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

export function seedState(): MockState {
  counter = 0;
  const mgr = id("aaaaaaaa"), rec = id("bbbbbbbb"), gst = id("cccccccc");
  const users = [
    { id: mgr, email: "manager@mabuhay.demo", full_name: "Ana Reyes", role: "manager" },
    { id: rec, email: "reception@mabuhay.demo", full_name: "Ben Cruz", role: "receptionist" },
    { id: gst, email: "guest@mabuhay.demo", full_name: "Gina Lopez", role: "guest" },
  ];

  const H = (name: string, location: string, near: string, description: string, rating: number, lat: number, lng: number) => ({
    id: id("dddddddd"), name, location, near_spot: near, description, image_url: null, rating, latitude: lat, longitude: lng, active: true,
  });
  const hotels = [
    H("Boracay Beachfront Haven", "Boracay, Aklan", "Boracay White Beach", "Steps away from crystal-clear waters and powdery white sand.", 4.8, 11.9674, 121.9248),
    H("Makati Skyline Luxury Suites", "Makati, Metro Manila", "Ayala Triangle Gardens", "City views, rooftop pool and a short walk to Makati's best dining.", 4.6, 14.5547, 121.0244),
    H("Siargao Cloud 9 Resort", "General Luna, Siargao", "Cloud 9 Surf Break", "Surf, sun and island sunsets minutes from the famous boardwalk.", 4.7, 9.8142, 126.1575),
    H("Baguio Pine Mountain Lodge", "Baguio, Benguet", "Burnham Park", "Cool pine-scented air and mountain views near the city center.", 4.5, 16.412, 120.5937),
    H("Cebu Bay Retreat", "Moalboal, Cebu", "Kawasan Falls", "A calm seaside base for canyoneering and turtle snorkeling.", 4.4, 9.944, 123.396),
    H("El Nido Lagoon Villas", "El Nido, Palawan", "Big Lagoon", "Private villas close to island-hopping tours and limestone cliffs.", 4.9, 11.1785, 119.3935),
  ];
  const R = (h: number, n: string, t: string, p: number, c: number, hk: "clean" | "dirty" = "clean") => ({
    id: id("eeeeeeee"), hotel_id: hotels[h].id, room_number: n, room_type: t, price_per_night: p, capacity: c, housekeeping: hk, active: true,
  });
  const rooms = [
    R(0, "Room 104", "Deluxe Beachfront", 2800, 2), R(0, "Room 106", "Family Room", 4200, 4), R(0, "Room 110", "Standard", 2200, 2),
    R(1, "Room 1205", "Luxury Suite", 12500, 3, "dirty"), R(1, "Room 1210", "Executive Suite", 14500, 3), R(1, "Room 905", "Deluxe", 8800, 2),
    R(2, "Room 302", "Surf Loft", 4200, 2, "dirty"), R(2, "Room 305", "Garden Bungalow", 3600, 3),
    R(3, "Room 208", "Mountain View", 3100, 2), R(3, "Room 210", "Family Cabin", 4800, 5),
    R(4, "Room 12", "Bay View", 3300, 2), R(4, "Room 14", "Family Room", 4500, 4),
    R(5, "Villa 1", "Lagoon Villa", 7800, 4), R(5, "Villa 2", "Cliffside Villa", 9200, 3),
  ];

  const B = (room: number, guest: string, inOff: number, nights: number, status: string, guests = 2) => {
    const r = rooms[room];
    return {
      id: id("ffffffff"), guest_id: guest, room_id: r.id, hotel_id: r.hotel_id, check_in: dateOffset(inOff), check_out: dateOffset(inOff + nights),
      guests, total_amount: nights * r.price_per_night, status, created_at: ago(60 * 24),
    };
  };
  const bookings = [
    B(0, gst, 0, 3, "confirmed"), // arriving today
    B(5, gst, 10, 2, "confirmed"),
    B(3, gst, -2, 4, "checked_in"), // in house
    B(12, gst, -20, 3, "checked_out"),
  ];

  const conv = { id: id("99999999"), user_a: [rec, gst].sort()[0], user_b: [rec, gst].sort()[1], created_at: ago(30) };
  const messages = [
    { id: id("88888888"), conversation_id: conv.id, sender_id: rec, body: "Good day Ms. Lopez! Your room at Boracay Beachfront Haven is ready for arrival. Anything we can prepare?", created_at: ago(20), read_at: null },
  ];
  const logs = [
    { id: id("77777777"), actor_id: rec, actor_role: "receptionist", action: "Reservation marked checked in", created_at: ago(120) },
    { id: id("77777777"), actor_id: gst, actor_role: "guest", action: "New reservation for room Room 104 (3 nights)", created_at: ago(60 * 24) },
  ];

  return {
    auth_users: users.map((u) => ({ id: u.id, email: u.email, password: DEMO_PASSWORD, full_name: u.full_name })),
    profiles: users.map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role, phone: null, currency: "PHP", push_enabled: true })),
    hotels, rooms, bookings, activity_logs: logs, conversations: [conv], messages, calls: [],
  };
}
