# Mabuhay Horizon

Hotel booking and reservation app for guests, receptionists and managers, built around
Philippine tourist spots. One Expo (React Native) codebase runs on **Android** and on the **web**
(PC browser). The backend is Supabase (database, login, realtime chat).

This project is separate from RentCare: its own code, its own Supabase project.

## Demo mode (no database needed)

With no `.env`, the app runs on a built-in mock backend (`lib/mock`). Everything works: booking, check-in/out, housekeeping, manager dashboard, chat and calls. Data is saved on the device and updates live (the "realtime" feel).

- Sign-in screen lists demo accounts: guest@mabuhay.demo, reception@mabuhay.demo, manager@mabuhay.demo, password `demo1234`.
- On web, open two browser tabs and sign in as different roles. Messages, bookings and call rings appear in the other tab instantly.
- Settings has a "Reset demo data" button.
- To use a real Supabase project instead, fill in `.env` (see `.env.example`). The mock switches off automatically.

## What each role can do

| Role | Can do |
|---|---|
| Guest | Browse hotels (even without an account), see them on a map, book a room for chosen dates, cancel an upcoming stay, chat with and call hotel staff, edit profile and preferences |
| Receptionist | Front desk: today's arrivals, check guests in and out, mark rooms clean or dirty, see all reservations, chat with and call anyone |
| Manager | Everything the receptionist does, plus the dashboard (occupancy, revenue, activity log), room prices and availability, adding rooms, and giving other accounts the receptionist or manager role |

Rules enforced by the database (not only the screens):
- A room can never be booked twice for overlapping nights.
- Only guests can book. Only staff can check in or out and change room cleaning status.
- New accounts are always guests. Only a manager can change roles.
- Guests can message and call staff only. Staff can message and call anyone.
- Chat and calls are private to the two people involved.

## Set up (about 10 minutes)

1. **Create a Supabase project** (free plan is fine).
2. In the Supabase **SQL Editor**, run `supabase/migrations/20261101_mabuhay_schema.sql`.
   It creates the tables, security rules, booking and chat functions, and six starter hotels.
3. In **Authentication, Providers, Email**, turn off "Confirm email" while testing
   (or confirm each test account from its email).
4. Copy `.env.example` to `.env` and fill in the project URL and the publishable (anon) key
   from **Project Settings, API**.
5. Install and run:
   ```
   npm install
   npx expo start --clear      # press "a" for Android (Expo Go), "w" for the browser
   ```
6. Sign up in the app, then make yourself the first manager. In the SQL Editor run:
   ```sql
   select public.bootstrap_first_manager('your-email@example.com');
   ```
   Sign out and in again. From the manager's Team tab you can promote receptionists.

## Calls

Tapping Call rings the other person inside the app. When they answer, both open the same free
video/voice room (Jitsi, `https://meet.jit.si` by default) in the browser or the Jitsi app.
Public Jitsi servers can ask the first person in a room to sign in. To avoid that, host your own
and set `EXPO_PUBLIC_CALL_BASE_URL` in `.env`.
Calls only ring while the other person has the app open. There is no phone-style push ring yet.

## Put it on the web

```
npx expo export --platform web
```
Upload the `dist` folder to any static host (Netlify, Vercel, Cloudflare Pages). Set the same
`EXPO_PUBLIC_*` variables in the host's settings before building.

## Checks

```
npm run typecheck
```
`supabase/tests` holds the database test script and the stand-ins it needs to run on plain Postgres.
