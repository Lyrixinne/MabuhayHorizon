\set ON_ERROR_STOP off
\pset pager off
\pset tuples_only on
-- helper: act as a user / as nobody
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','g1@x.com','{"full_name":"Guest One","role":"manager"}'),
 ('00000000-0000-0000-0000-0000000000a2','g2@x.com','{"full_name":"Guest Two"}'),
 ('00000000-0000-0000-0000-0000000000b1','r1@x.com','{"full_name":"Rita Reception"}'),
 ('00000000-0000-0000-0000-0000000000c1','m1@x.com','{"full_name":"Manny Manager"}');

\echo '== T1 new accounts are guests (even if sign-up data says manager): expect guest'
select role from public.profiles where email='g1@x.com';

\echo '== T2 a guest cannot make themselves manager: expect guest'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
update public.profiles set role='manager', email='hack@x.com' where id='00000000-0000-0000-0000-0000000000a1';
select role||' '||email from public.profiles where id='00000000-0000-0000-0000-0000000000a1';
reset role;

\echo '== T3 bootstrap first manager, second attempt fails'
select public.bootstrap_first_manager('m1@x.com');
select public.bootstrap_first_manager('g1@x.com');
select role from public.profiles where email='m1@x.com';
\echo '== T3b app roles cannot call bootstrap: expect permission denied'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); select public.bootstrap_first_manager('g1@x.com'); reset role;

\echo '== T4 manager makes a receptionist; guest cannot; manager cannot change self'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.set_user_role('00000000-0000-0000-0000-0000000000b1','receptionist');
select public.set_user_role('00000000-0000-0000-0000-0000000000c1','guest');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.set_user_role('00000000-0000-0000-0000-0000000000a2','manager');
reset role;
select role from public.profiles where email='r1@x.com';

\echo '== T5 anonymous visitor: hotels visible (6), profiles/bookings hidden (0/0)'
set role anon; select pg_temp.as_user(null);
select (select count(*) from public.hotels)||' '||(select count(*) from public.profiles)||' '||(select count(*) from public.bookings);
reset role;

\echo '== T6 booking rules'
select id as room104 from public.rooms where room_number='Room 104' \gset
select id as hotel_b from public.hotels where name like 'Boracay%' \gset
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
\echo 'ok booking (expect 3 nights, 8400)'
select (nights||' '||total)::text from (select (check_out-check_in) nights, total_amount total from public.create_booking(:'room104', current_date+5, current_date+8, 2)) x;
\echo 'overlap (expect not available)'
select public.create_booking(:'room104', current_date+6, current_date+9, 2);
\echo 'adjacent check-in on the checkout day (expect ok)'
select (check_in)::text from public.create_booking(:'room104', current_date+8, current_date+10, 2);
\echo 'too many guests (expect fits up to 2)'
select public.create_booking(:'room104', current_date+20, current_date+21, 3);
\echo 'past date'
select public.create_booking(:'room104', current_date-1, current_date+1, 1);
\echo 'checkout before checkin'
select public.create_booking(:'room104', current_date+30, current_date+30, 1);
\echo '31 nights'
select public.create_booking(:'room104', current_date+40, current_date+71, 1);
reset role;

\echo '== T7 direct table writes are blocked'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.bookings(guest_id,room_id,hotel_id,check_in,check_out,guests,total_amount) values ('00000000-0000-0000-0000-0000000000a1',:'room104',:'hotel_b',current_date+50,current_date+52,1,1);
update public.bookings set status='cancelled', total_amount=0;
delete from public.bookings;
reset role;
select 'bookings now: '||count(*)||' statuses: '||string_agg(distinct status,',')||' min total: '||min(total_amount) from public.bookings;

\echo '== T8 staff cannot book'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.create_booking(:'room104', current_date+60, current_date+61, 1);
reset role;

\echo '== T9 availability hides booked rooms (expect Room 104 missing, 2 left)'
select string_agg(room_number, ',' order by room_number) from public.available_rooms(:'hotel_b', current_date+6, current_date+7, 1);
\echo '   and shows it for free dates (expect 3)'
select count(*) from public.available_rooms(:'hotel_b', current_date+100, current_date+101, 1);

\echo '== T10 check-in, check-out, housekeeping, cancel'
select id as room905 from public.rooms where room_number='Room 905' \gset
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select id as todaybk from public.create_booking(:'room905', current_date, current_date+2, 2) \gset
\echo 'guest cannot check themselves in (expect staff only)'
select public.set_booking_status(:'todaybk','checked_in');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
\echo 'future booking cannot be checked in early'
select id as futurebk from public.bookings where room_id=:'room104' order by check_in limit 1 \gset
select public.set_booking_status(:'futurebk','checked_in');
\echo 'receptionist checks in (expect checked_in)'
select status from public.set_booking_status(:'todaybk','checked_in');
\echo 'illegal jump (expect not allowed)'
select public.set_booking_status(:'todaybk','confirmed');
\echo 'check out (expect checked_out), then room dirty'
select status from public.set_booking_status(:'todaybk','checked_out');
select housekeeping from public.rooms where id=:'room905';
\echo 'toggle housekeeping (expect clean)'
select housekeeping from public.toggle_housekeeping(:'room905');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
\echo 'other guest cannot cancel a booking that is not theirs (expect not found)'
select public.cancel_booking(:'futurebk');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
\echo 'owner cancels (expect cancelled)'
select status from public.cancel_booking(:'futurebk');
\echo 'cancelled booking cannot be cancelled again'
select public.cancel_booking(:'futurebk');
\echo 'cancelled dates are free again (expect ok)'
select (check_in)::text from public.create_booking(:'room104', current_date+5, current_date+8, 2);
reset role;

\echo '== T11 manager stats'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.manager_stats();
select count(*) from public.recent_activity(50);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.manager_stats();
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select count(*) from public.list_users();
reset role;

\echo '== T12 chat'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
\echo 'guest -> guest (expect cannot message)'
select public.get_or_create_conversation('00000000-0000-0000-0000-0000000000a2');
\echo 'guest -> receptionist twice returns the same id (expect t)'
select public.get_or_create_conversation('00000000-0000-0000-0000-0000000000b1') as c1 \gset
select (public.get_or_create_conversation('00000000-0000-0000-0000-0000000000b1') = :'c1'::uuid)::text;
insert into public.messages(conversation_id, sender_id, body) values (:'c1','00000000-0000-0000-0000-0000000000a1','hello');
\echo 'spoofed sender (expect row-level block)'
insert into public.messages(conversation_id, sender_id, body) values (:'c1','00000000-0000-0000-0000-0000000000b1','fake');
\echo 'empty message (expect rejected)'
insert into public.messages(conversation_id, sender_id, body) values (:'c1','00000000-0000-0000-0000-0000000000a1','');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
\echo 'outsider reads 0 and cannot post'
select count(*) from public.messages;
insert into public.messages(conversation_id, sender_id, body) values (:'c1','00000000-0000-0000-0000-0000000000a2','sneak');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
\echo 'receptionist sees 1 message, unread 1, then 0 after reading'
select count(*) from public.messages;
select unread from public.my_conversations();
select public.mark_conversation_read(:'c1');
select unread from public.my_conversations();
\echo 'staff can start a chat with any guest (expect uuid)'
select (public.get_or_create_conversation('00000000-0000-0000-0000-0000000000a2') is not null)::text;
reset role;

\echo '== T13 calls'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select id as call1 from public.start_call('00000000-0000-0000-0000-0000000000b1') \gset
select (room_name like 'mabuhay-%')::text from public.calls where id=:'call1';
\echo 'guest cannot call a guest (expect cannot call)'
select public.start_call('00000000-0000-0000-0000-0000000000a2');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
\echo 'outsider cannot answer (expect not found)'
select public.respond_call(:'call1','accepted');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
\echo 'caller cannot answer own call (expect only callee)'
select public.respond_call(:'call1','accepted');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
\echo 'callee accepts (expect accepted), ends (expect ended)'
select status from public.respond_call(:'call1','accepted');
select status from public.respond_call(:'call1','ended');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select id as call2 from public.start_call('00000000-0000-0000-0000-0000000000b1') \gset
\echo 'caller cancels (expect cancelled)'
select status from public.respond_call(:'call2','cancelled');
select id as call3 from public.start_call('00000000-0000-0000-0000-0000000000b1') \gset
reset role;
update public.calls set created_at = now() - interval '2 minutes' where id=:'call3';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
\echo 'late answer (expect call has ended)'
select public.respond_call(:'call3','accepted');
\echo 'new call replaces an unanswered one (expect 1 ringing)'
reset role; update public.calls set status='ended' where status='ringing'; set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select count(*) from public.start_call('00000000-0000-0000-0000-0000000000b1');
select count(*) from public.start_call('00000000-0000-0000-0000-0000000000b1');
select count(*) from public.calls where status='ringing';
reset role;

\echo '== T14 directory'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
\echo 'guest sees staff only (expect 2: manager, receptionist)'
select string_agg(role, ',') from public.contact_directory();
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
\echo 'staff sees everyone else (expect 3)'
select count(*) from public.contact_directory();
reset role;

\echo '== T15 who can read what'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
\echo 'guest sees only own profile (1), own bookings'
select count(*) from public.profiles;
select count(*) from public.bookings;
select count(*) from public.activity_logs;
reset role;
\echo '== T16 only the manager changes hotels'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
update public.hotels set name='Hacked'; delete from public.rooms;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
update public.rooms set price_per_night=3000 where room_number='Room 110';
reset role;
select (select count(*) from public.hotels where name='Hacked')||' hacked, rooms '||(select count(*) from public.rooms)||', price '||(select price_per_night from public.rooms where room_number='Room 110');
