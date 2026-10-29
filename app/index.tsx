import React from "react";
import { Redirect } from "expo-router";
import { Text } from "react-native";
import { homeRouteFor, useAuth } from "../lib/auth-context";
import { Button, Centered, Spinner } from "../components/ui";

export default function Index() {
  const { profile, loading, session, browsing, refreshProfile, signOut } = useAuth();
  if (loading) return <Spinner />;
  if (profile) return <Redirect href={homeRouteFor(profile.role)} />;
  if (session) {
    // Signed in but the profile could not be loaded (for example no connection).
    return (
      <Centered>
        <Text style={{ fontSize: 16, marginBottom: 16, textAlign: "center" }}>We could not load your account. Check your connection.</Text>
        <Button label="Try again" onPress={refreshProfile} style={{ marginBottom: 10 }} />
        <Button label="Sign out" kind="soft" onPress={signOut} />
      </Centered>
    );
  }
  if (browsing) return <Redirect href="/(guest)/explore" />;
  return <Redirect href="/welcome" />;
}
