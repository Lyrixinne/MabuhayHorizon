export type Role = "guest" | "receptionist" | "manager";
export type Currency = "PHP" | "USD";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  phone: string | null;
  currency: Currency;
  push_enabled: boolean;
};

export type Hotel = {
  id: string;
  name: string;
  location: string;
  near_spot: string;
  description: string;
  image_url: string | null;
  rating: number;
  latitude: number;
  longitude: number;
  active: boolean;
};

export type Room = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  price_per_night: number;
  capacity: number;
  housekeeping: "clean" | "dirty";
  active: boolean;
};

export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled";

export type Booking = {
  id: string;
  guest_id: string;
  room_id: string;
  hotel_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_amount: number;
  status: BookingStatus;
  created_at: string;
  rooms?: { room_number: string; room_type: string } | null;
  hotels?: { name: string } | null;
  profiles?: { full_name: string } | null;
};

export type Conversation = {
  conversation_id: string;
  other_id: string;
  other_name: string;
  other_role: Role;
  last_body: string | null;
  last_at: string;
  unread: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type Call = {
  id: string;
  caller_id: string;
  callee_id: string;
  room_name: string;
  status: "ringing" | "accepted" | "declined" | "cancelled" | "ended";
  created_at: string;
};

export type Contact = { id: string; full_name: string; role: Role };
