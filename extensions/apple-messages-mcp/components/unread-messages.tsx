import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
  defineWidget,
  useAppleScript,
  useCloseWidget,
} from "@eney/api";
import { useUnreadMessages, formatGroupTime, cleanMessageText, UnreadMessage } from "../helpers/messages-db.js";
import { resolveContactNames } from "../helpers/contacts.js";
import { openMessagesChat, sendMessage } from "../helpers/messages-actions.js";

const schema = z.object({
  limit: z
    .number()
    .optional()
    .describe("Maximum number of unread messages to fetch. Defaults to 50."),
});

type Props = z.infer<typeof schema>;

type View = "default" | "reply" | "sent";

interface ChatOption {
  chatIdentifier: string;
  senderHandle: string;
  label: string;
  messages: UnreadMessage[];
}

function buildMarkdown(messages: UnreadMessage[]): string {
  if (messages.length === 0) return "No messages.";

  const sorted = [...messages].sort((a, b) => a.sentAt - b.sentAt);

  // Group by minute
  const groups: { minute: number; time: string; texts: string[] }[] = [];
  let lastMinute = -1;

  for (const m of sorted) {
    const minute = Math.floor(m.sentAt / 60);
    const text = cleanMessageText(m.text, m.attachmentFilename);

    if (minute !== lastMinute) {
      groups.push({ minute, time: formatGroupTime(m.sentAt), texts: [text] });
      lastMinute = minute;
    } else {
      groups[groups.length - 1].texts.push(text);
    }
  }

  return groups
    .map((g) => `*${g.time}*\n\n${g.texts.join("\n")}`)
    .join("\n\n");
}

function buildCloseContext(chats: ChatOption[]): string {
  if (chats.length === 0) return "No unread messages.";

  return chats.map((c) => {
    const sorted = [...c.messages].sort((a, b) => a.sentAt - b.sentAt);
    const count = sorted.length;
    const chatHeader = `💬 **${c.label}**`;

    // Group messages by minute
    const groups: { time: string; texts: string[] }[] = [];
    let lastMinute = -1;

    for (const m of sorted) {
      const minute = Math.floor(m.sentAt / 60);
      const text = cleanMessageText(m.text, m.attachmentFilename);

      if (minute !== lastMinute) {
        groups.push({ time: formatGroupTime(m.sentAt), texts: [text] });
        lastMinute = minute;
      } else {
        groups[groups.length - 1].texts.push(text);
      }
    }

    const body = groups
      .map((g) => `*${g.time}*\n\n${g.texts.join("\n")}`)
      .join("\n\n");

    return `${chatHeader}\n\n${body}`;
  }).join("\n\n---\n\n");
}

function UnreadMessages(props: Props) {
  const closeWidget = useCloseWidget();
  const runAppleScript = useAppleScript();
  const limit = props.limit ?? 50;
  const { data: rawMessages, isLoading: dbLoading, error } = useUnreadMessages();

  const [chats, setChats] = useState<ChatOption[]>([]);
  const [selectedChat, setSelectedChat] = useState("");
  const [loadingStatus, setLoadingStatus] = useState("Loading messages…");
  const [ready, setReady] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [view, setView] = useState<View>("default");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    if (dbLoading) { setLoadingStatus("Loading messages…"); return; }

    const limited = rawMessages.slice(0, limit);
    if (limited.length === 0) { setReady(true); return; }

    setLoadingStatus("Resolving contacts…");

    const identifiers = [...new Set(limited.map((m) => m.senderHandle).filter(Boolean))];
    resolveContactNames(identifiers)
      .then((names) => {
        // Build chat options with resolved names
        const chatMap = new Map<string, ChatOption>();
        for (const m of limited) {
          if (!chatMap.has(m.chatIdentifier)) {
            const name = names.get(m.senderHandle) ?? m.displayName ?? m.senderHandle;
            chatMap.set(m.chatIdentifier, { chatIdentifier: m.chatIdentifier, senderHandle: m.senderHandle, label: name, messages: [] });
          }
          chatMap.get(m.chatIdentifier)!.messages.push(m);
        }

        const options = [...chatMap.values()].map((c) => ({
          ...c,
          label: `${c.label} (${c.messages.length} unread${c.messages.length !== 1 ? "s" : ""})`,
        }));

        setChats(options);
        setSelectedChat(options[0]?.chatIdentifier ?? "");
        setReady(true);
      })
      .catch((e) => {
        setContactsError(e instanceof Error ? e.message : String(e));
        setReady(true);
      });
  }, [dbLoading, rawMessages.length]);

  const header = <CardHeader title="Unread Messages" iconBundleId="com.apple.MobileSMS" />;

  const defaultActions = (
    <ActionPanel layout="column">
      <ActionPanel layout="row">
        <Action
          title="Open Chat"
          onAction={() => {
            if (selectedChat) openMessagesChat(runAppleScript, selectedChat);
            closeWidget(buildCloseContext(chats));
          }}
          style="secondary"
          isDisabled={!selectedChat}
        />
        <Action
          title="Reply"
          onAction={() => setView("reply")}
          style="primary"
          isDisabled={!selectedChat}
        />
      </ActionPanel>
      <Action
        title="Done"
        onAction={() => closeWidget(buildCloseContext(chats))}
        style="secondary"
      />
    </ActionPanel>
  );

  if (!ready) {
    return (
      <Form header={header} actions={defaultActions}>
        <Paper markdown={loadingStatus} />
      </Form>
    );
  }

  const selectedMessages = chats.find((c) => c.chatIdentifier === selectedChat)?.messages ?? [];

  if (view === "sent") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action
              title="Ok. Message is sent."
              onAction={() => {
                setView("default");
                setReplyText("");
              }}
              style="primary"
            />
          </ActionPanel>
        }
      >
        <Paper markdown="Your message has been sent." />
      </Form>
    );
  }

  if (view === "reply") {
    async function handleSend() {
      const chat = chats.find((c) => c.chatIdentifier === selectedChat);
      if (!chat || !replyText.trim()) return;
      setIsSending(true);
      setSendError("");
      try {
        await sendMessage(runAppleScript, chat.senderHandle, replyText.trim());
        setView("sent");
      } catch (e) {
        setSendError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsSending(false);
      }
    }

    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action
              title="Cancel"
              onAction={() => {
                setView("default");
                setSendError("");
              }}
              style="secondary"
            />
            <Action
              title={isSending ? "Sending…" : "Send"}
              onAction={handleSend}
              style="primary"
              isLoading={isSending}
              isDisabled={!replyText.trim() || isSending}
            />
          </ActionPanel>
        }
      >
        {sendError && <Paper markdown={`**Error:** ${sendError}`} />}
        <Paper markdown={buildMarkdown(selectedMessages)} />
        <Form.TextField
          name="reply"
          label="Reply"
          value={replyText}
          onChange={setReplyText}
        />
      </Form>
    );
  }

  return (
    <Form header={header} actions={defaultActions}>
      {error && <Paper markdown={`**DB Error:** ${error.message}`} />}
      {contactsError && <Paper markdown={`**Contacts Error:** ${contactsError}`} />}
      {chats.length === 0 && <Paper markdown="No unread messages." />}
      {chats.length > 0 && (
        <Form.Dropdown name="chat" label="Conversation" value={selectedChat} onChange={setSelectedChat}>
          {chats.map((c) => (
            <Form.Dropdown.Item key={c.chatIdentifier} title={c.label} value={c.chatIdentifier} />
          ))}
        </Form.Dropdown>
      )}
      {selectedChat && <Paper markdown={buildMarkdown(selectedMessages)} />}
    </Form>
  );
}

const UnreadMessagesWidget = defineWidget({
  name: "unread-messages",
  description:
    "Search chat history for unread messages waiting on a reply. Returns a natural language summary grouped by sender — who wrote, how many messages, and the content.",
  schema,
  component: UnreadMessages,
});

export default UnreadMessagesWidget;
