import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { useCalls } from "../lib/call-context";
import { friendlyError } from "../lib/errors";
import { notify } from "../lib/dialog";
import { timeAgo } from "../lib/format";
import type { Contact, Conversation, Message } from "../lib/types";
import { Button, Empty, Pill, Spinner, Title } from "./ui";
import { colors, MAX_WIDTH, radius } from "../constants/theme";

type Other = { id: string; name: string; role: string };

export function ChatScreen() {
  const router = useRouter();
  const { session, setBrowsing } = useAuth();
  const me = session?.user.id ?? null;
  const { startCall } = useCalls();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<{ id: string; other: Other } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const loadConversations = useCallback(async () => {
    if (!me) return;
    const { data, error } = await supabase.rpc("my_conversations");
    if (error) notify("Could not load chats", friendlyError(error, "Please try again."));
    else setConversations((data ?? []) as Conversation[]);
    setLoading(false);
  }, [me]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Any new message in one of my chats refreshes the list (unread counts, last message).
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`chat-list-${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadConversations())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, loadConversations]);

  const openPicker = async () => {
    const { data, error } = await supabase.rpc("contact_directory");
    if (error) return notify("Could not load contacts", friendlyError(error, "Please try again."));
    setContacts((data ?? []) as Contact[]);
    setPickerOpen(true);
  };

  const startWith = async (c: Contact) => {
    const { data, error } = await supabase.rpc("get_or_create_conversation", { p_other: c.id });
    if (error || !data) return notify("Could not start the chat", friendlyError(error, "Please try again."));
    setPickerOpen(false);
    setActive({ id: data as string, other: { id: c.id, name: c.full_name, role: c.role } });
    loadConversations();
  };

  if (!session) {
    return (
      <View style={styles.centerWrap}>
        <Title sub="Sign in to message and call the hotel team.">Chat</Title>
        <Button label="Sign In" onPress={() => { setBrowsing(false); router.replace("/sign-in"); }} />
      </View>
    );
  }

  if (active && me) {
    return (
      <Thread
        me={me}
        conversationId={active.id}
        other={active.other}
        onBack={() => { setActive(null); loadConversations(); }}
        onCall={() => startCall(active.other.id, active.other.name)}
      />
    );
  }

  if (loading) return <Spinner />;

  return (
    <View style={styles.listWrap}>
      <View style={styles.listInner}>
        <View style={styles.listHead}>
          <Title sub="Message or call anyone you are allowed to contact">Chat</Title>
        </View>
        <Button label="Start a new chat" onPress={openPicker} style={{ marginBottom: 14 }} />
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.conversation_id}
          ListEmptyComponent={<Empty text="No chats yet. Tap “Start a new chat”." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActive({ id: item.conversation_id, other: { id: item.other_id, name: item.other_name, role: item.other_role } })}
              style={styles.row}
            >
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.other_name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.name}>{item.other_name}</Text>
                  <Pill text={item.other_role} tone="gray" />
                </View>
                <Text style={styles.last} numberOfLines={1}>{item.last_body ?? "No messages yet"}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={styles.time}>{timeAgo(item.last_at)}</Text>
                {item.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View> : null}
              </View>
            </Pressable>
          )}
        />
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={styles.sheetTitle}>Who do you want to contact?</Text>
              <Pressable onPress={() => setPickerOpen(false)}><Text style={styles.close}>Close</Text></Pressable>
            </View>
            <FlatList
              data={contacts}
              keyExtractor={(c) => c.id}
              ListEmptyComponent={<Empty text="Nobody to contact yet." />}
              renderItem={({ item }) => (
                <Pressable onPress={() => startWith(item)} style={styles.row}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{item.full_name.slice(0, 1).toUpperCase()}</Text></View>
                  <Text style={[styles.name, { flex: 1 }]}>{item.full_name}</Text>
                  <Pill text={item.role} tone={item.role === "manager" ? "orange" : item.role === "receptionist" ? "blue" : "gray"} />
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Thread({ me, conversationId, other, onBack, onCall }: { me: string; conversationId: string; other: Other; onBack: () => void; onCall: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const markRead = useCallback(() => {
    supabase.rpc("mark_conversation_read", { p_conversation: conversationId }).then(() => {});
  }, [conversationId]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) notify("Could not load messages", friendlyError(error, "Please try again."));
        else setMessages((data ?? []) as Message[]);
        markRead();
      });
    const ch = supabase
      .channel(`thread-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (m.sender_id !== me) markRead();
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [conversationId, me, markRead]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body })
      .select()
      .single();
    setSending(false);
    if (error) return notify("Message not sent", friendlyError(error, "Please try again."));
    setText("");
    const m = data as Message;
    setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
  };

  return (
    <KeyboardAvoidingView style={styles.threadWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.threadInner}>
        <View style={styles.threadHead}>
          <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.close}>‹ Back</Text></Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.name} numberOfLines={1}>{other.name}</Text>
            <Text style={styles.time}>{other.role}</Text>
          </View>
          <Button label="📞 Call" kind="dark" small onPress={onCall} />
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Empty text={`Say hello to ${other.name}.`} />}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, mine && { color: "#CBD5E1" }]}>{timeAgo(item.created_at)}</Text>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor="#94A3B8"
            style={styles.composerInput}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
          />
          <Button label="Send" onPress={send} loading={sending} disabled={!text.trim()} small />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, padding: 24, backgroundColor: colors.bg, justifyContent: "center", maxWidth: 480, width: "100%", alignSelf: "center" },
  listWrap: { flex: 1, backgroundColor: colors.bg },
  listInner: { flex: 1, padding: 18, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
  listHead: { marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  last: { color: colors.muted, marginTop: 3, fontSize: 14 },
  time: { color: colors.muted, fontSize: 12 },
  badge: { backgroundColor: colors.blue, minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: "100%", maxWidth: 560, maxHeight: "80%" },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: colors.text },
  close: { color: colors.blue, fontSize: 16, fontWeight: "700" },
  threadWrap: { flex: 1, backgroundColor: colors.bg },
  threadInner: { flex: 1, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
  threadHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.line },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.blue, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: "#E2E8F0", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 16, color: colors.text },
  bubbleTime: { fontSize: 11, color: colors.muted, marginTop: 4, alignSelf: "flex-end" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.line },
  composerInput: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120, color: colors.text },
});
