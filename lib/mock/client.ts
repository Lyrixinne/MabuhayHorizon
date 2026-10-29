// A small in-app stand-in for Supabase, used when no .env is set.
// It keeps all data on the device (saved between launches) and sends live
// "realtime" events to every open screen. On web it also reaches other
// browser tabs, so you can sign in as guest in one tab and as staff in another
// and chat, call and book live between them.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedState, type MockState } from "./seed";

const STATE_KEY = "mabuhay-mock-state-v1";
const SESSION_KEY = "mabuhay-mock-session-v1";

type Row = Record<string, any>;
type Err = { message: string; code?: string } | null;

class MockError extends Error {}
const fail = (message: string): never => {
  throw new MockError(message);
};

const uuid = () => {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID() as string;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 3) | 8).toString(16);
  });
};
const nowIso = () => new Date().toISOString();
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayNumber = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

// ---------------------------------------------------------------- state
let state: MockState = seedState();
let uid: string | null = null;
let hydrated = false;

const sessionStore = {
  get: async (): Promise<string | null> => {
    try {
      if (typeof sessionStorage !== "undefined") return sessionStorage.getItem(SESSION_KEY); // one user per browser tab
    } catch {}
    return AsyncStorage.getItem(SESSION_KEY);
  },
  set: async (v: string | null) => {
    try {
      if (typeof sessionStorage !== "undefined") {
        if (v) sessionStorage.setItem(SESSION_KEY, v);
        else sessionStorage.removeItem(SESSION_KEY);
        return;
      }
    } catch {}
    if (v) await AsyncStorage.setItem(SESSION_KEY, v);
    else await AsyncStorage.removeItem(SESSION_KEY);
  },
};

const ready = (async () => {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch {}
  try {
    const s = await sessionStore.get();
    if (s && state.auth_users.some((u) => u.id === s)) uid = s;
  } catch {}
  hydrated = true;
})();

const persist = () => {
  AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
};

// ------------------------------------------------------------- realtime
type Listener = { event: string; table: string; filter?: string; cb: (p: any) => void };
const listeners = new Set<Listener>();
const authListeners = new Set<(event: string, session: any) => void>();
const bc: any = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("mabuhay-mock") : null;

const matches = (l: Listener, event: string, table: string, row: Row) => {
  if (l.table !== table) return false;
  if (l.event !== "*" && l.event !== event) return false;
  if (l.filter) {
    const m = /^([a-z_]+)=eq\.(.+)$/.exec(l.filter);
    if (m && String(row[m[1]]) !== m[2]) return false;
  }
  return true;
};
const notify = (event: string, table: string, row: Row, old: Row | null) => {
  for (const l of Array.from(listeners)) {
    if (matches(l, event, table, row)) {
      setTimeout(() => l.cb({ eventType: event, schema: "public", table, new: row, old: old ?? {} }), 30);
    }
  }
};
const rows = (table: string): Row[] => (state as any)[table];

const commit = (event: "INSERT" | "UPDATE" | "DELETE", table: string, row: Row, old: Row | null = null) => {
  persist();
  notify(event, table, row, old);
  bc?.postMessage({ event, table, row, old });
};
if (bc) {
  bc.onmessage = async (e: MessageEvent) => {
    await ready;
    const { event, table, row, old } = e.data as { event: string; table: string; row: Row; old: Row | null };
    const list = rows(table);
    const i = list.findIndex((r) => r.id === row.id);
    if (event === "DELETE") {
      if (i >= 0) list.splice(i, 1);
    } else if (i >= 0) list[i] = row;
    else list.push(row);
    notify(event, table, row, old);
    persist();
  };
}

// ------------------------------------------------------------ helpers
const me = () => (uid ? state.profiles.find((p) => p.id === uid) ?? null : null);
const isStaff = () => ["receptionist", "manager"].includes(me()?.role);
const isManager = () => me()?.role === "manager";

const logActivity = (action: string) => {
  const row = { id: uuid(), actor_id: uid, actor_role: me()?.role ?? null, action, created_at: nowIso() };
  state.activity_logs.push(row);
  commit("INSERT", "activity_logs", row);
};
const upd = (table: string, row: Row, changes: Row) => {
  const old = { ...row };
  Object.assign(row, changes);
  commit("UPDATE", table, { ...row }, old);
  return row;
};
const ins = (table: string, row: Row) => {
  rows(table).push(row);
  commit("INSERT", table, { ...row });
  return row;
};
const canContact = (other: string) => {
  const m = me();
  const o = state.profiles.find((p) => p.id === other);
  if (!m || !o || o.id === m.id) return false;
  return m.role === "guest" ? ["receptionist", "manager"].includes(o.role) : true;
};

// ---------------------------------------------------------------- RPCs
const rpcs: Record<string, (a: Row) => any> = {
  available_rooms: (a) =>
    state.rooms
      .filter(
        (r) =>
          r.hotel_id === a.p_hotel &&
          r.active &&
          r.capacity >= Math.max(a.p_guests ?? 1, 1) &&
          !state.bookings.some(
            (b) =>
              b.room_id === r.id &&
              ["confirmed", "checked_in"].includes(b.status) &&
              dayNumber(b.check_in) < dayNumber(a.p_check_out) &&
              dayNumber(a.p_check_in) < dayNumber(b.check_out),
          ),
      )
      .sort((x, y) => x.price_per_night - y.price_per_night)
      .map((r) => ({ ...r })),

  create_booking: (a) => {
    if (!uid) fail("Please sign in to book a room.");
    if (me()?.role !== "guest") fail("Only guest accounts can book a room.");
    if (!a.p_check_in || !a.p_check_out || a.p_check_in < todayStr()) fail("Choose a check-in date that is today or later.");
    if (a.p_check_out <= a.p_check_in) fail("Check-out must be after check-in.");
    const nights = dayNumber(a.p_check_out) - dayNumber(a.p_check_in);
    if (nights > 30) fail("You can book up to 30 nights at a time.");
    const room = state.rooms.find((r) => r.id === a.p_room && r.active);
    if (!room) fail("That room is no longer available.");
    if (!a.p_guests || a.p_guests < 1 || a.p_guests > room!.capacity) fail(`This room fits up to ${room!.capacity} guests.`);
    const clash = state.bookings.some(
      (b) =>
        b.room_id === room!.id &&
        ["confirmed", "checked_in"].includes(b.status) &&
        dayNumber(b.check_in) < dayNumber(a.p_check_out) &&
        dayNumber(a.p_check_in) < dayNumber(b.check_out),
    );
    if (clash) fail("That room is not available for those dates. Please choose other dates or another room.");
    const row = ins("bookings", {
      id: uuid(),
      guest_id: uid,
      room_id: room!.id,
      hotel_id: room!.hotel_id,
      check_in: a.p_check_in,
      check_out: a.p_check_out,
      guests: a.p_guests,
      total_amount: nights * room!.price_per_night,
      status: "confirmed",
      created_at: nowIso(),
    });
    logActivity(`New reservation for room ${room!.room_number} (${nights} nights)`);
    return { ...row };
  },

  cancel_booking: (a) => {
    const b = state.bookings.find((x) => x.id === a.p_booking);
    if (!b || (b.guest_id !== uid && !isStaff())) fail("Reservation not found.");
    if (b!.status !== "confirmed") fail("Only an upcoming reservation can be cancelled.");
    upd("bookings", b!, { status: "cancelled" });
    logActivity("Reservation cancelled");
    return { ...b };
  },

  set_booking_status: (a) => {
    if (!isStaff()) fail("Only hotel staff can do this.");
    const b = state.bookings.find((x) => x.id === a.p_booking);
    if (!b) fail("Reservation not found.");
    if (b!.status === "confirmed" && a.p_status === "checked_in") {
      if (b!.check_in > todayStr()) fail("Guests can only check in from their arrival date.");
    } else if (b!.status === "checked_in" && a.p_status === "checked_out") {
      const room = state.rooms.find((r) => r.id === b!.room_id);
      if (room) upd("rooms", room, { housekeeping: "dirty" });
    } else if (b!.status === "confirmed" && a.p_status === "cancelled") {
      // allowed
    } else fail("That change is not allowed for this reservation.");
    upd("bookings", b!, { status: a.p_status });
    logActivity(`Reservation marked ${String(a.p_status).replace("_", " ")}`);
    return { ...b };
  },

  toggle_housekeeping: (a) => {
    if (!isStaff()) fail("Only hotel staff can do this.");
    const r = state.rooms.find((x) => x.id === a.p_room);
    if (!r) fail("Room not found.");
    upd("rooms", r!, { housekeeping: r!.housekeeping === "clean" ? "dirty" : "clean" });
    logActivity(`Room ${r!.room_number} marked ${r!.housekeeping}`);
    return { ...r };
  },

  manager_stats: () => {
    if (!isManager()) fail("Only the manager can see this.");
    const active = state.rooms.filter((r) => r.active).length;
    const occupied = new Set(state.bookings.filter((b) => b.status === "checked_in").map((b) => b.room_id)).size;
    const month = todayStr().slice(0, 7);
    const revenue = state.bookings
      .filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.check_in.slice(0, 7) === month)
      .reduce((s, b) => s + Number(b.total_amount), 0);
    const arrivals = state.bookings.filter((b) => b.check_in === todayStr() && ["confirmed", "checked_in"].includes(b.status)).length;
    return {
      active_rooms: active,
      occupied_rooms: occupied,
      occupancy_percent: active === 0 ? 0 : Math.round((100 * occupied) / active),
      month_revenue: revenue,
      arrivals_today: arrivals,
    };
  },

  recent_activity: (a) => {
    if (!isManager()) fail("Only the manager can see this.");
    const limit = Math.max(Math.min(a.p_limit ?? 20, 100), 1);
    return [...state.activity_logs]
      .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        action: l.action,
        actor_name: state.profiles.find((p) => p.id === l.actor_id)?.full_name ?? "System",
        actor_role: l.actor_role ?? "system",
        created_at: l.created_at,
      }));
  },

  list_users: () => {
    if (!isManager()) fail("Only the manager can see this.");
    return state.profiles
      .map((p) => ({ id: p.id, full_name: p.full_name, email: p.email, role: p.role }))
      .sort((x, y) => x.role.localeCompare(y.role) || x.full_name.localeCompare(y.full_name));
  },

  set_user_role: (a) => {
    if (!isManager()) fail("Only the manager can change roles.");
    if (!["guest", "receptionist", "manager"].includes(a.p_role)) fail("Choose guest, receptionist or manager.");
    if (a.p_user === uid) fail("You cannot change your own role.");
    const p = state.profiles.find((x) => x.id === a.p_user);
    if (!p) fail("User not found.");
    upd("profiles", p!, { role: a.p_role });
    logActivity(`Role changed to ${a.p_role}`);
    return null;
  },

  contact_directory: () => {
    if (!uid) return [];
    const order: Record<string, number> = { manager: 0, receptionist: 1, guest: 2 };
    return state.profiles
      .filter((p) => p.id !== uid && (me()?.role === "guest" ? ["receptionist", "manager"].includes(p.role) : true))
      .sort((x, y) => order[x.role] - order[y.role] || x.full_name.localeCompare(y.full_name))
      .map((p) => ({ id: p.id, full_name: p.full_name, role: p.role }));
  },

  get_or_create_conversation: (a) => {
    if (!canContact(a.p_other)) fail("You cannot message this person.");
    const [ua, ub] = [uid!, a.p_other].sort();
    let c = state.conversations.find((x) => x.user_a === ua && x.user_b === ub);
    if (!c) c = ins("conversations", { id: uuid(), user_a: ua, user_b: ub, created_at: nowIso() }) as any;
    return c!.id;
  },

  my_conversations: () =>
    state.conversations
      .filter((c) => c.user_a === uid || c.user_b === uid)
      .map((c) => {
        const other = state.profiles.find((p) => p.id === (c.user_a === uid ? c.user_b : c.user_a))!;
        const msgs = state.messages.filter((m) => m.conversation_id === c.id).sort((x, y) => (x.created_at < y.created_at ? -1 : 1));
        const last = msgs[msgs.length - 1];
        return {
          conversation_id: c.id,
          other_id: other.id,
          other_name: other.full_name,
          other_role: other.role,
          last_body: last?.body ?? null,
          last_at: last?.created_at ?? c.created_at,
          unread: msgs.filter((m) => m.sender_id !== uid && !m.read_at).length,
        };
      })
      .sort((x, y) => (x.last_at < y.last_at ? 1 : -1)),

  mark_conversation_read: (a) => {
    const c = state.conversations.find((x) => x.id === a.p_conversation && (x.user_a === uid || x.user_b === uid));
    if (!c) return null;
    for (const m of state.messages) {
      if (m.conversation_id === c.id && m.sender_id !== uid && !m.read_at) upd("messages", m, { read_at: nowIso() });
    }
    return null;
  },

  start_call: (a) => {
    if (!canContact(a.p_callee)) fail("You cannot call this person.");
    for (const c of state.calls) {
      if (c.caller_id === uid && c.callee_id === a.p_callee && c.status === "ringing") upd("calls", c, { status: "cancelled", ended_at: nowIso() });
    }
    const row = ins("calls", {
      id: uuid(),
      caller_id: uid,
      callee_id: a.p_callee,
      room_name: "mabuhay-" + uuid().replace(/-/g, ""),
      status: "ringing",
      created_at: nowIso(),
      answered_at: null,
      ended_at: null,
    });
    return { ...row };
  },

  respond_call: (a) => {
    const c = state.calls.find((x) => x.id === a.p_call);
    if (!c || (uid !== c.caller_id && uid !== c.callee_id)) fail("Call not found.");
    const s = a.p_status;
    if (s === "accepted" || s === "declined") {
      if (uid !== c!.callee_id) fail("Only the person being called can answer.");
      if (c!.status !== "ringing" || Date.now() - Date.parse(c!.created_at) > 60000) fail("This call has ended.");
    } else if (s === "cancelled") {
      if (uid !== c!.caller_id || c!.status !== "ringing") fail("This call cannot be cancelled.");
    } else if (s === "ended") {
      if (!["accepted", "ringing"].includes(c!.status)) fail("This call has already ended.");
    } else fail("Unknown call action.");
    upd("calls", c!, {
      status: s,
      answered_at: s === "accepted" ? nowIso() : c!.answered_at,
      ended_at: s === "accepted" ? null : nowIso(),
    });
    return { ...c };
  },
};

// ---------------------------------------------------------- query builder
const EMBEDS: Record<string, Record<string, (r: Row) => Row | Row[] | null>> = {
  bookings: {
    rooms: (r) => state.rooms.find((x) => x.id === r.room_id) ?? null,
    hotels: (r) => state.hotels.find((x) => x.id === r.hotel_id) ?? null,
    profiles: (r) => state.profiles.find((x) => x.id === r.guest_id) ?? null,
  },
  hotels: { rooms: (r) => state.rooms.filter((x) => x.hotel_id === r.id) },
  rooms: { hotels: (r) => state.hotels.find((x) => x.id === r.hotel_id) ?? null },
};

const splitTop = (s: string) => {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const pick = (r: Row, cols: string) => {
  const list = splitTop(cols);
  if (list.includes("*")) return { ...r };
  const o: Row = {};
  for (const c of list) o[c] = r[c];
  return o;
};
const project = (table: string, r: Row, select: string) => {
  const parts = splitTop(select);
  const base: Row = {};
  const plain = parts.filter((p) => !p.includes("("));
  Object.assign(base, plain.length ? pick(r, plain.join(",")) : {});
  for (const p of parts) {
    const m = /^([a-z_]+)\((.*)\)$/.exec(p);
    if (!m) continue;
    const fn = EMBEDS[table]?.[m[1]];
    const val = fn ? fn(r) : null;
    base[m[1]] = Array.isArray(val) ? val.map((v) => pick(v, m[2])) : val ? pick(val, m[2]) : null;
  }
  return base;
};

const cond = (r: Row, expr: string): boolean => {
  const and = /^and\((.*)\)$/.exec(expr);
  if (and) return splitTop(and[1]).every((e) => cond(r, e));
  const m = /^([a-z_]+)\.(eq|lte|gte|lt|gt|neq)\.(.*)$/.exec(expr);
  if (!m) return true;
  const [, col, op, val] = m;
  const v = String(r[col]);
  if (op === "eq") return v === val;
  if (op === "neq") return v !== val;
  if (op === "lte") return v <= val;
  if (op === "gte") return v >= val;
  if (op === "lt") return v < val;
  return v > val;
};

const canSee = (table: string, r: Row) => {
  if (table === "bookings") return isStaff() || r.guest_id === uid;
  if (table === "messages") return state.conversations.some((c) => c.id === r.conversation_id && (c.user_a === uid || c.user_b === uid));
  if (table === "profiles") return isStaff() || r.id === uid;
  if (table === "calls") return r.caller_id === uid || r.callee_id === uid;
  if (table === "conversations") return r.user_a === uid || r.user_b === uid;
  if (table === "activity_logs") return isManager();
  return true;
};

class Query implements PromiseLike<{ data: any; error: Err }> {
  private op: "select" | "insert" | "update" = "select";
  private selectStr = "*";
  private payload: Row = {};
  private filters: ((r: Row) => boolean)[] = [];
  private orderCol: string | null = null;
  private asc = true;
  private lim: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private returning = false;
  constructor(private table: string) {}

  select(cols = "*") {
    if (this.op === "select") this.selectStr = cols;
    else {
      this.returning = true;
      this.selectStr = cols;
    }
    return this;
  }
  insert(v: Row) {
    this.op = "insert";
    this.payload = v;
    return this;
  }
  update(v: Row) {
    this.op = "update";
    this.payload = v;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((r) => String(r[col]) === String(val));
    return this;
  }
  or(expr: string) {
    const parts = splitTop(expr);
    this.filters.push((r) => parts.some((p) => cond(r, p)));
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) {
    this.orderCol = col;
    this.asc = o?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private run(): { data: any; error: Err } {
    const t = this.table;
    if (!uid && !["hotels", "rooms"].includes(t)) return { data: this.mode === "many" ? [] : null, error: null };
    let result: Row[] = [];
    if (this.op === "insert") {
      const v = this.payload;
      if (t === "messages") {
        const conv = state.conversations.find((c) => c.id === v.conversation_id);
        if (!uid || v.sender_id !== uid || !conv || (conv.user_a !== uid && conv.user_b !== uid) || !String(v.body ?? "").trim())
          fail("new row violates row-level security policy for table \"messages\"");
        result = [ins("messages", { id: uuid(), conversation_id: v.conversation_id, sender_id: uid, body: String(v.body).trim(), created_at: nowIso(), read_at: null })];
      } else if (t === "rooms") {
        if (!isManager()) fail("new row violates row-level security policy for table \"rooms\"");
        result = [
          ins("rooms", {
            id: uuid(),
            hotel_id: v.hotel_id,
            room_number: v.room_number,
            room_type: v.room_type ?? "Standard",
            price_per_night: v.price_per_night,
            capacity: v.capacity ?? 2,
            housekeeping: "clean",
            active: true,
          }),
        ];
      } else fail(`permission denied for table ${t}`);
    } else if (this.op === "update") {
      const targets = rows(t).filter((r) => canSee(t, r) && this.filters.every((f) => f(r)));
      const allowed = (r: Row): Row => {
        if (t === "rooms" || t === "hotels") {
          if (!isManager()) return {};
          return this.payload;
        }
        if (t === "profiles") {
          if (r.id !== uid) return {};
          const { full_name, phone, currency, push_enabled } = this.payload;
          return Object.fromEntries(Object.entries({ full_name, phone, currency, push_enabled }).filter(([, x]) => x !== undefined));
        }
        return {};
      };
      for (const r of targets) {
        const ch = allowed(r);
        if (Object.keys(ch).length) upd(t, r, ch);
      }
      result = targets;
    } else {
      result = rows(t).filter((r) => canSee(t, r) && this.filters.every((f) => f(r)));
      if (t === "rooms" && !isStaff()) result = result.filter((r) => r.active);
      if (this.orderCol) {
        const c = this.orderCol;
        result = [...result].sort((x, y) => (x[c] === y[c] ? 0 : (x[c] > y[c] ? 1 : -1) * (this.asc ? 1 : -1)));
      }
      if (this.lim != null) result = result.slice(0, this.lim);
    }
    if (this.op !== "select" && !this.returning) return { data: null, error: null };
    const out = result.map((r) => project(t, r, this.selectStr));
    if (this.mode === "many") return { data: out, error: null };
    if (out.length > 1 && this.mode === "single") return { data: null, error: { message: "Multiple rows returned" } };
    if (!out.length) return this.mode === "single" ? { data: null, error: { message: "No rows found", code: "PGRST116" } } : { data: null, error: null };
    return { data: out[0], error: null };
  }

  then<T1 = { data: any; error: Err }, T2 = never>(
    ok?: ((v: { data: any; error: Err }) => T1 | PromiseLike<T1>) | null,
    bad?: ((e: any) => T2 | PromiseLike<T2>) | null,
  ) {
    const p = (async () => {
      await ready;
      await new Promise((r) => setTimeout(r, 40)); // a little latency, like a real server
      try {
        return this.run();
      } catch (e: any) {
        return { data: null, error: { message: e?.message ?? "Something went wrong" } as Err };
      }
    })();
    return p.then(ok, bad);
  }
}

// ----------------------------------------------------------------- client
const sessionFor = (id: string | null) => {
  const u = id ? state.auth_users.find((x) => x.id === id) : null;
  return u ? { access_token: "mock-" + u.id, user: { id: u.id, email: u.email, user_metadata: { full_name: u.full_name } } } : null;
};
const setUid = async (id: string | null, event: string) => {
  uid = id;
  await sessionStore.set(id);
  const s = sessionFor(id);
  for (const cb of Array.from(authListeners)) cb(event, s); // like supabase-js: listeners run before sign-in resolves
  return s;
};

export const mockClient = {
  from: (table: string) => new Query(table),

  rpc: (name: string, args: Row = {}) =>
    (async () => {
      await ready;
      await new Promise((r) => setTimeout(r, 40));
      const fn = rpcs[name];
      if (!fn) return { data: null, error: { message: "Unknown function" } as Err };
      try {
        return { data: fn(args), error: null as Err };
      } catch (e: any) {
        return { data: null, error: { message: e?.message ?? "Something went wrong" } as Err };
      }
    })(),

  channel: (_name: string) => {
    const mine: Listener[] = [];
    const ch: any = {
      _mine: mine,
      on(_type: string, opts: { event: string; table: string; filter?: string }, cb: (p: any) => void) {
        mine.push({ event: opts.event, table: opts.table, filter: opts.filter, cb });
        return ch;
      },
      subscribe() {
        mine.forEach((l) => listeners.add(l));
        return ch;
      },
    };
    return ch;
  },
  removeChannel: (ch: any) => {
    ch?._mine?.forEach((l: Listener) => listeners.delete(l));
    return Promise.resolve("ok");
  },

  auth: {
    getSession: async () => {
      await ready;
      return { data: { session: sessionFor(uid) }, error: null };
    },
    onAuthStateChange: (cb: (event: string, session: any) => void) => {
      authListeners.add(cb);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      await ready;
      const u = state.auth_users.find((x) => x.email === email.trim().toLowerCase());
      if (!u || u.password !== password) return { data: { session: null }, error: { message: "Invalid login credentials" } };
      const session = await setUid(u.id, "SIGNED_IN");
      return { data: { session, user: session!.user }, error: null };
    },
    signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string } } }) => {
      await ready;
      const e = email.trim().toLowerCase();
      if (password.length < 6) return { data: { session: null, user: null }, error: { message: "Password should be at least 6 characters." } };
      if (state.auth_users.some((x) => x.email === e)) return { data: { session: null, user: null }, error: { message: "User already registered" } };
      const name = options?.data?.full_name?.trim() || e.split("@")[0];
      const id = uuid();
      const au = { id, email: e, password, full_name: name };
      state.auth_users.push(au);
      bc?.postMessage({ event: "INSERT", table: "auth_users", row: au, old: null });
      ins("profiles", { id, full_name: name, email: e, role: "guest", phone: null, currency: "PHP", push_enabled: true });
      const session = await setUid(id, "SIGNED_IN");
      return { data: { session, user: session!.user }, error: null };
    },
    signOut: async () => {
      await ready;
      await setUid(null, "SIGNED_OUT");
      return { error: null };
    },
    updateUser: async ({ password }: { password?: string }) => {
      await ready;
      const u = state.auth_users.find((x) => x.id === uid);
      if (!u) return { data: null, error: { message: "Please sign in first." } };
      if (password) {
        if (password.length < 6) return { data: null, error: { message: "Password should be at least 6 characters." } };
        u.password = password;
        persist();
      }
      return { data: { user: sessionFor(uid)?.user }, error: null };
    },
  },
};

/** Wipes everything back to the starting demo data and signs out. */
export async function resetMockData() {
  await ready;
  state = seedState();
  persist();
  await setUid(null, "SIGNED_OUT");
}
export const mockIsHydrated = () => hydrated;
