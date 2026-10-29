import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { friendlyError } from "./errors";
import type { Currency, Profile } from "./types";

type Result = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; error: string };

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Someone who tapped "Continue as Guest": can look around but not book or chat. */
  browsing: boolean;
  setBrowsing: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (fullName: string, email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (changes: Partial<Pick<Profile, "full_name" | "phone" | "currency" | "push_enabled">>) => Promise<Result>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [browsing, setBrowsing] = useState(false);

  // Restore the saved session and follow sign-in / sign-out.
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!error && data) setProfile(data as Profile);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      loadProfile();
    }
  }, [userId, loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { ok: false, error: friendlyError(error, "Could not sign in. Please try again.") };
    setBrowsing(false);
    return { ok: true };
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string): Promise<Result> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) return { ok: false, error: friendlyError(error, "Could not create your account. Please try again.") };
    setBrowsing(false);
    return { ok: true, needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setBrowsing(false);
  }, []);

  const updateProfile = useCallback(
    async (changes: Partial<Pick<Profile, "full_name" | "phone" | "currency" | "push_enabled">>): Promise<Result> => {
      if (!userId) return { ok: false, error: "Please sign in first." };
      const { error } = await supabase.from("profiles").update(changes).eq("id", userId);
      if (error) return { ok: false, error: friendlyError(error, "Could not save your changes.") };
      setProfile((p) => (p ? { ...p, ...changes } : p));
      return { ok: true };
    },
    [userId],
  );

  const value = useMemo<AuthValue>(
    () => ({ session, profile, loading, browsing, setBrowsing, signIn, signUp, signOut, refreshProfile: loadProfile, updateProfile }),
    [session, profile, loading, browsing, signIn, signUp, signOut, loadProfile, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useCurrency(): Currency {
  return useAuth().profile?.currency ?? "PHP";
}

export function homeRouteFor(role: Profile["role"] | undefined): "/(guest)/explore" | "/(receptionist)/desk" | "/(manager)/dashboard" {
  if (role === "manager") return "/(manager)/dashboard";
  if (role === "receptionist") return "/(receptionist)/desk";
  return "/(guest)/explore";
}
