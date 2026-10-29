-- Mabuhay Horizon: hotel booking and reservation app.
-- Roles: guest, receptionist, manager. Everything the app needs lives in this file.
-- Run it once in the Supabase SQL Editor (or as a migration) on a NEW project.

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles (one per sign-in). Everybody starts as a guest.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'guest' check (role in ('guest', 'receptionist', 'manager')),
  phone text,
  currency text not null default 'PHP' check (currency in ('PHP', 'USD')),
  push_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- The role is never taken from sign-up data: every new account is a guest.
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    lower(coalesce(new.email, ''))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A user can edit their own details but never their id, email or role.
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
    if coalesce(current_setting('app.role_change', true), '') <> 'on' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile();

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$ select coalesce(public.my_role() in ('receptionist', 'manager'), false) $$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$ select coalesce(public.my_role() = 'manager', false) $$;

-- ---------------------------------------------------------------------------
-- Hotels and rooms
-- ---------------------------------------------------------------------------
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  near_spot text not null,
  description text not null default '',
  image_url text,
  rating numeric(2, 1) not null default 4.5 check (rating between 0 and 5),
  latitude double precision not null,
  longitude double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_number text not null,
  room_type text not null default 'Standard',
  price_per_night numeric(10, 2) not null check (price_per_night > 0),
  capacity integer not null default 2 check (capacity > 0),
  housekeeping text not null default 'clean' check (housekeeping in ('clean', 'dirty')),
  active boolean not null default true,
  unique (hotel_id, room_number)
);

-- ---------------------------------------------------------------------------
-- Bookings. A room cannot be booked twice for overlapping nights.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  created_at timestamptz not null default now(),
  check (check_out > check_in),
  constraint bookings_no_overlap exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('confirmed', 'checked_in'))
);

create index bookings_guest_idx on public.bookings (guest_id, created_at desc);
create index bookings_hotel_idx on public.bookings (hotel_id, check_in);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Chat and calls (any two people who are allowed to contact each other)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  room_name text not null,
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  check (caller_id <> callee_id)
);
create index calls_callee_idx on public.calls (callee_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: nothing is readable unless a rule says so.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.hotels enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;

create policy "profiles read own or staff" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "hotels public read" on public.hotels
  for select to anon, authenticated using (active or public.is_staff());
create policy "hotels manager insert" on public.hotels
  for insert to authenticated with check (public.is_manager());
create policy "hotels manager update" on public.hotels
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "hotels manager delete" on public.hotels
  for delete to authenticated using (public.is_manager());

create policy "rooms public read" on public.rooms
  for select to anon, authenticated using (active or public.is_staff());
create policy "rooms manager insert" on public.rooms
  for insert to authenticated with check (public.is_manager());
create policy "rooms manager update" on public.rooms
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "rooms manager delete" on public.rooms
  for delete to authenticated using (public.is_manager());

-- Bookings are read here and changed only through the functions below.
create policy "bookings read own or staff" on public.bookings
  for select to authenticated using (guest_id = auth.uid() or public.is_staff());

create policy "activity read manager" on public.activity_logs
  for select to authenticated using (public.is_manager());

create policy "conversations read own" on public.conversations
  for select to authenticated using (auth.uid() in (user_a, user_b));

create policy "messages read in my conversations" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
             where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
  );
create policy "messages send in my conversations" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                 where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
  );

create policy "calls read own" on public.calls
  for select to authenticated using (auth.uid() in (caller_id, callee_id));

-- ---------------------------------------------------------------------------
-- Booking functions
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(p_action text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.activity_logs (actor_id, actor_role, action)
  values (auth.uid(), public.my_role(), p_action)
$$;

create or replace function public.available_rooms(
  p_hotel uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer default 1
)
returns setof public.rooms
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.*
    from public.rooms r
   where r.hotel_id = p_hotel
     and r.active
     and r.capacity >= greatest(coalesce(p_guests, 1), 1)
     and not exists (
       select 1 from public.bookings b
        where b.room_id = r.id
          and b.status in ('confirmed', 'checked_in')
          and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
     )
   order by r.price_per_night
$$;

create or replace function public.create_booking(
  p_room uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer
)
returns public.bookings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_nights integer;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'Please sign in to book a room.';
  end if;
  if public.my_role() is distinct from 'guest' then
    raise exception 'Only guest accounts can book a room.';
  end if;
  if p_check_in is null or p_check_out is null or p_check_in < current_date then
    raise exception 'Choose a check-in date that is today or later.';
  end if;
  if p_check_out <= p_check_in then
    raise exception 'Check-out must be after check-in.';
  end if;
  v_nights := p_check_out - p_check_in;
  if v_nights > 30 then
    raise exception 'You can book up to 30 nights at a time.';
  end if;

  select * into v_room from public.rooms where id = p_room and active;
  if not found then
    raise exception 'That room is no longer available.';
  end if;
  if p_guests is null or p_guests < 1 or p_guests > v_room.capacity then
    raise exception 'This room fits up to % guests.', v_room.capacity;
  end if;

  begin
    insert into public.bookings (guest_id, room_id, hotel_id, check_in, check_out, guests, total_amount)
    values (v_uid, v_room.id, v_room.hotel_id, p_check_in, p_check_out, p_guests, v_nights * v_room.price_per_night)
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'That room is not available for those dates. Please choose other dates or another room.';
  end;

  perform public.log_activity('New reservation for room ' || v_room.room_number || ' (' || v_nights || ' nights)');
  return v_booking;
end;
$$;

create or replace function public.cancel_booking(p_booking uuid)
returns public.bookings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_b public.bookings;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'Reservation not found.';
  end if;
  if v_b.guest_id <> auth.uid() and not public.is_staff() then
    raise exception 'Reservation not found.';
  end if;
  if v_b.status <> 'confirmed' then
    raise exception 'Only an upcoming reservation can be cancelled.';
  end if;
  update public.bookings set status = 'cancelled' where id = p_booking returning * into v_b;
  perform public.log_activity('Reservation cancelled');
  return v_b;
end;
$$;

create or replace function public.set_booking_status(p_booking uuid, p_status text)
returns public.bookings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_b public.bookings;
begin
  if not public.is_staff() then
    raise exception 'Only hotel staff can do this.';
  end if;
  select * into v_b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'Reservation not found.';
  end if;

  if v_b.status = 'confirmed' and p_status = 'checked_in' then
    if v_b.check_in > current_date then
      raise exception 'Guests can only check in from their arrival date.';
    end if;
  elsif v_b.status = 'checked_in' and p_status = 'checked_out' then
    update public.rooms set housekeeping = 'dirty' where id = v_b.room_id;
  elsif v_b.status = 'confirmed' and p_status = 'cancelled' then
    null;
  else
    raise exception 'That change is not allowed for this reservation.';
  end if;

  update public.bookings set status = p_status where id = p_booking returning * into v_b;
  perform public.log_activity('Reservation marked ' || replace(p_status, '_', ' '));
  return v_b;
end;
$$;

create or replace function public.toggle_housekeeping(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_r public.rooms;
begin
  if not public.is_staff() then
    raise exception 'Only hotel staff can do this.';
  end if;
  update public.rooms
     set housekeeping = case when housekeeping = 'clean' then 'dirty' else 'clean' end
   where id = p_room
   returning * into v_r;
  if not found then
    raise exception 'Room not found.';
  end if;
  perform public.log_activity('Room ' || v_r.room_number || ' marked ' || v_r.housekeeping);
  return v_r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Manager functions
-- ---------------------------------------------------------------------------
create or replace function public.manager_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rooms integer;
  v_occupied integer;
  v_revenue numeric;
  v_arrivals integer;
begin
  if not public.is_manager() then
    raise exception 'Only the manager can see this.';
  end if;
  select count(*) into v_rooms from public.rooms where active;
  select count(distinct room_id) into v_occupied from public.bookings where status = 'checked_in';
  select coalesce(sum(total_amount), 0) into v_revenue
    from public.bookings
   where status in ('confirmed', 'checked_in', 'checked_out')
     and date_trunc('month', check_in) = date_trunc('month', current_date);
  select count(*) into v_arrivals
    from public.bookings
   where check_in = current_date and status in ('confirmed', 'checked_in');
  return jsonb_build_object(
    'active_rooms', v_rooms,
    'occupied_rooms', v_occupied,
    'occupancy_percent', case when v_rooms = 0 then 0 else round(100.0 * v_occupied / v_rooms) end,
    'month_revenue', v_revenue,
    'arrivals_today', v_arrivals
  );
end;
$$;

create or replace function public.recent_activity(p_limit integer default 20)
returns table (id uuid, action text, actor_name text, actor_role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_manager() then
    raise exception 'Only the manager can see this.';
  end if;
  return query
    select l.id, l.action, coalesce(p.full_name, 'System'), coalesce(l.actor_role, 'system'), l.created_at
      from public.activity_logs l
      left join public.profiles p on p.id = l.actor_id
     order by l.created_at desc
     limit greatest(least(coalesce(p_limit, 20), 100), 1);
end;
$$;

create or replace function public.list_users()
returns table (id uuid, full_name text, email text, role text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_manager() then
    raise exception 'Only the manager can see this.';
  end if;
  return query select p.id, p.full_name, p.email, p.role from public.profiles p order by p.role, p.full_name;
end;
$$;

create or replace function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_manager() then
    raise exception 'Only the manager can change roles.';
  end if;
  if p_role not in ('guest', 'receptionist', 'manager') then
    raise exception 'Choose guest, receptionist or manager.';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role.';
  end if;
  perform set_config('app.role_change', 'on', true);
  update public.profiles set role = p_role where id = p_user;
  if not found then
    raise exception 'User not found.';
  end if;
  perform public.log_activity('Role changed to ' || p_role);
end;
$$;

-- Run once from the SQL Editor (not callable from the app) to create the first manager.
create or replace function public.bootstrap_first_manager(p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (select 1 from public.profiles where role = 'manager') then
    raise exception 'A manager already exists.';
  end if;
  perform set_config('app.role_change', 'on', true);
  update public.profiles set role = 'manager' where email = lower(trim(p_email));
  if not found then
    raise exception 'No account with that email. Sign up in the app first.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat and call functions
-- ---------------------------------------------------------------------------
-- Guests can contact staff only. Staff can contact anyone.
create or replace function public.can_contact(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null
     and p_other is not null
     and p_other <> auth.uid()
     and exists (select 1 from public.profiles o where o.id = p_other)
     and case
           when public.my_role() = 'guest'
             then (select o.role in ('receptionist', 'manager') from public.profiles o where o.id = p_other)
           else public.my_role() is not null
         end
$$;

create or replace function public.contact_directory()
returns table (id uuid, full_name text, role text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.full_name, p.role
    from public.profiles p
   where auth.uid() is not null
     and p.id <> auth.uid()
     and case
           when public.my_role() = 'guest' then p.role in ('receptionist', 'manager')
           else true
         end
   order by case p.role when 'manager' then 0 when 'receptionist' then 1 else 2 end, p.full_name
$$;

create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if not public.can_contact(p_other) then
    raise exception 'You cannot message this person.';
  end if;
  v_a := least(auth.uid(), p_other);
  v_b := greatest(auth.uid(), p_other);
  select id into v_id from public.conversations where user_a = v_a and user_b = v_b;
  if v_id is null then
    insert into public.conversations (user_a, user_b) values (v_a, v_b)
    on conflict (user_a, user_b) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations where user_a = v_a and user_b = v_b;
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_name text,
  other_role text,
  last_body text,
  last_at timestamptz,
  unread bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id,
         o.id,
         o.full_name,
         o.role,
         (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         coalesce((select max(m.created_at) from public.messages m where m.conversation_id = c.id), c.created_at),
         (select count(*) from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
    from public.conversations c
    join public.profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
   where auth.uid() in (c.user_a, c.user_b)
   order by 6 desc
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.messages m
     set read_at = now()
   where m.conversation_id = p_conversation
     and m.sender_id <> auth.uid()
     and m.read_at is null
     and exists (select 1 from public.conversations c
                  where c.id = p_conversation and auth.uid() in (c.user_a, c.user_b))
$$;

create or replace function public.start_call(p_callee uuid)
returns public.calls
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_call public.calls;
begin
  if not public.can_contact(p_callee) then
    raise exception 'You cannot call this person.';
  end if;
  update public.calls
     set status = 'cancelled', ended_at = now()
   where caller_id = auth.uid() and callee_id = p_callee and status = 'ringing';
  insert into public.calls (caller_id, callee_id, room_name)
  values (auth.uid(), p_callee, 'mabuhay-' || replace(gen_random_uuid()::text, '-', ''))
  returning * into v_call;
  return v_call;
end;
$$;

create or replace function public.respond_call(p_call uuid, p_status text)
returns public.calls
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_c public.calls;
begin
  select * into v_c from public.calls where id = p_call for update;
  if not found or auth.uid() not in (v_c.caller_id, v_c.callee_id) then
    raise exception 'Call not found.';
  end if;

  if p_status in ('accepted', 'declined') then
    if auth.uid() <> v_c.callee_id then
      raise exception 'Only the person being called can answer.';
    end if;
    if v_c.status <> 'ringing' or v_c.created_at < now() - interval '60 seconds' then
      raise exception 'This call has ended.';
    end if;
  elsif p_status = 'cancelled' then
    if auth.uid() <> v_c.caller_id or v_c.status <> 'ringing' then
      raise exception 'This call cannot be cancelled.';
    end if;
  elsif p_status = 'ended' then
    if v_c.status not in ('accepted', 'ringing') then
      raise exception 'This call has already ended.';
    end if;
  else
    raise exception 'Unknown call action.';
  end if;

  update public.calls
     set status = p_status,
         answered_at = case when p_status = 'accepted' then now() else answered_at end,
         ended_at = case when p_status = 'accepted' then null else now() end
   where id = p_call
   returning * into v_c;
  return v_c;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function
  public.available_rooms(uuid, date, date, integer),
  public.create_booking(uuid, date, date, integer),
  public.cancel_booking(uuid),
  public.set_booking_status(uuid, text),
  public.toggle_housekeeping(uuid),
  public.manager_stats(),
  public.recent_activity(integer),
  public.list_users(),
  public.set_user_role(uuid, text),
  public.contact_directory(),
  public.get_or_create_conversation(uuid),
  public.my_conversations(),
  public.mark_conversation_read(uuid),
  public.start_call(uuid),
  public.respond_call(uuid, text),
  public.my_role(),
  public.is_staff(),
  public.is_manager()
  to authenticated;

grant execute on function public.available_rooms(uuid, date, date, integer) to anon;
-- Used inside row rules: policies run as the caller, so the role checks must be callable.
grant execute on function public.my_role(), public.is_staff(), public.is_manager() to anon;

-- ---------------------------------------------------------------------------
-- Live updates for chat, calls and reservations
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.calls, public.bookings;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Starter hotels near Philippine tourist spots
-- ---------------------------------------------------------------------------
do $$
declare
  h_boracay uuid := gen_random_uuid();
  h_makati uuid := gen_random_uuid();
  h_siargao uuid := gen_random_uuid();
  h_baguio uuid := gen_random_uuid();
  h_cebu uuid := gen_random_uuid();
  h_elnido uuid := gen_random_uuid();
begin
  insert into public.hotels (id, name, location, near_spot, description, rating, latitude, longitude) values
    (h_boracay, 'Boracay Beachfront Haven', 'Boracay, Aklan', 'Boracay White Beach', 'Steps away from crystal-clear waters and powdery white sand.', 4.8, 11.9674, 121.9248),
    (h_makati, 'Makati Skyline Luxury Suites', 'Makati, Metro Manila', 'Ayala Triangle Gardens', 'City views, rooftop pool and a short walk to Makati''s best dining.', 4.6, 14.5547, 121.0244),
    (h_siargao, 'Siargao Cloud 9 Resort', 'General Luna, Siargao', 'Cloud 9 Surf Break', 'Surf, sun and island sunsets minutes from the famous boardwalk.', 4.7, 9.8142, 126.1575),
    (h_baguio, 'Baguio Pine Mountain Lodge', 'Baguio, Benguet', 'Burnham Park', 'Cool pine-scented air and mountain views near the city center.', 4.5, 16.4120, 120.5937),
    (h_cebu, 'Cebu Bay Retreat', 'Moalboal, Cebu', 'Kawasan Falls', 'A calm seaside base for canyoneering and turtle snorkeling.', 4.4, 9.9440, 123.3960),
    (h_elnido, 'El Nido Lagoon Villas', 'El Nido, Palawan', 'Big Lagoon', 'Private villas close to island-hopping tours and limestone cliffs.', 4.9, 11.1785, 119.3935);

  insert into public.rooms (hotel_id, room_number, room_type, price_per_night, capacity, housekeeping) values
    (h_boracay, 'Room 104', 'Deluxe Beachfront', 2800, 2, 'clean'),
    (h_boracay, 'Room 106', 'Family Room', 4200, 4, 'clean'),
    (h_boracay, 'Room 110', 'Standard', 2200, 2, 'clean'),
    (h_makati, 'Room 1205', 'Luxury Suite', 12500, 3, 'dirty'),
    (h_makati, 'Room 1210', 'Executive Suite', 14500, 3, 'clean'),
    (h_makati, 'Room 905', 'Deluxe', 8800, 2, 'clean'),
    (h_siargao, 'Room 302', 'Surf Loft', 4200, 2, 'dirty'),
    (h_siargao, 'Room 305', 'Garden Bungalow', 3600, 3, 'clean'),
    (h_baguio, 'Room 208', 'Mountain View', 3100, 2, 'clean'),
    (h_baguio, 'Room 210', 'Family Cabin', 4800, 5, 'clean'),
    (h_cebu, 'Room 12', 'Bay View', 3300, 2, 'clean'),
    (h_cebu, 'Room 14', 'Family Room', 4500, 4, 'clean'),
    (h_elnido, 'Villa 1', 'Lagoon Villa', 7800, 4, 'clean'),
    (h_elnido, 'Villa 2', 'Cliffside Villa', 9200, 3, 'clean');
end $$;
