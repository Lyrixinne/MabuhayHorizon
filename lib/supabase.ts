import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mockClient } from "./mock/client";

// Set these two in .env (see .env.example) to use a real Supabase project.
// Without them the app runs in demo mode on an on-device mock backend (see lib/mock).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isLiveBackend = url.startsWith("http") && anonKey.length > 20;
export const isMockBackend = !isLiveBackend;

export const supabase: SupabaseClient = isLiveBackend
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : (mockClient as unknown as SupabaseClient);
