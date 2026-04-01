import { useSQL } from "@eney/api";

const DB_PATH = `${process.env.HOME}/Library/Messages/chat.db`;

// Normalize macOS date: nanoseconds since 2001-01-01 → Unix timestamp
const DATE_EXPR = `CASE WHEN m.date > 1e10 THEN m.date / 1000000000 ELSE m.date END + 978307200`;

export function formatSentAt(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Format timestamp as grouped header: time only for today, "d mon time" for this year, "d mon year time" for older
export function formatGroupTime(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) return time;

  const day = date.getDate();
  const mon = date.toLocaleDateString([], { month: "short" }).toLowerCase();

  if (date.getFullYear() !== now.getFullYear()) {
    return `${day} ${mon} ${date.getFullYear()} ${time}`;
  }

  return `${day} ${mon} ${time}`;
}

function attachmentLabel(filename: string | null): string {
  if (filename) {
    const name = filename.split("/").pop() ?? filename;
    return `(${name})`;
  }
  return "[attachment]";
}

// Strip U+FFFC (object replacement) and other invisible chars macOS embeds in message text
export function cleanMessageText(
  raw: string | null,
  filename?: string | null,
): string {
  if (raw) {
    const cleaned = raw.replace(/[\uFFFC\uFFA4\u200B-\u200D\uFEFF]/g, "").trim();
    if (cleaned) return cleaned;
  }
  return attachmentLabel(filename ?? null);
}

export interface UnreadMessage {
  messageId: number;
  text: string;
  attachmentFilename: string | null;
  senderHandle: string;
  chatIdentifier: string;
  displayName: string;
  sentAt: number;
  isGroupChat: number;
}

export interface Chat {
  chatIdentifier: string;
  displayName: string;
  serviceName: string;
}

export interface ChatMessage {
  messageId: number;
  text: string;
  isFromMe: number;
  senderHandle: string;
  sentAt: number;
}

export function buildUnreadMessagesQuery(): string {
  return `
    SELECT
      m.ROWID AS messageId,
      m.text AS text,
      a.filename AS attachmentFilename,
      COALESCE(h.id, '') AS senderHandle,
      c.chat_identifier AS chatIdentifier,
      COALESCE(NULLIF(c.display_name, ''), c.chat_identifier) AS displayName,
      (${DATE_EXPR}) AS sentAt,
      CASE WHEN c.room_name IS NOT NULL AND c.room_name != '' THEN 1 ELSE 0 END AS isGroupChat
    FROM message m
    JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    JOIN chat c ON c.ROWID = cmj.chat_id
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    LEFT JOIN message_attachment_join maj ON maj.message_id = m.ROWID
    LEFT JOIN attachment a ON a.ROWID = maj.attachment_id
    WHERE m.is_from_me = 0
      AND m.is_read = 0
    ORDER BY sentAt DESC
  `;
}

export function useUnreadMessages() {
  const state = useSQL<UnreadMessage[]>(DB_PATH, buildUnreadMessagesQuery());
  return { ...state, data: state.data ?? [] };
}

export function buildChatsQuery(): string {
  return `
    SELECT
      c.chat_identifier AS chatIdentifier,
      COALESCE(NULLIF(c.display_name, ''), c.chat_identifier) AS displayName,
      c.service_name AS serviceName
    FROM chat c
    JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
    JOIN message m ON m.ROWID = cmj.message_id
    WHERE m.text IS NOT NULL
    GROUP BY c.ROWID
    ORDER BY MAX(${DATE_EXPR}) DESC
  `;
}

export function useChats() {
  const state = useSQL<Chat[]>(DB_PATH, buildChatsQuery());
  return { ...state, data: state.data ?? [] };
}

function sanitizeChatIdentifier(id: string): string {
  return id.replace(/[^a-zA-Z0-9+@.\-_ ]/g, "");
}

export function buildHistoryQuery(chatIdentifier: string, limit: number): string {
  const safeId = sanitizeChatIdentifier(chatIdentifier);
  const safeLimit = Math.max(1, Math.floor(limit));
  return `
    SELECT
      m.ROWID AS messageId,
      m.text AS text,
      m.is_from_me AS isFromMe,
      COALESCE(h.id, '') AS senderHandle,
      (${DATE_EXPR}) AS sentAt
    FROM message m
    JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    JOIN chat c ON c.ROWID = cmj.chat_id
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    WHERE c.chat_identifier = '${safeId}'
      AND m.text IS NOT NULL
    ORDER BY sentAt DESC
    LIMIT ${safeLimit}
  `;
}

export function useChatHistory(
  chatIdentifier: string,
  limit: number,
  execute: boolean,
) {
  const sql = buildHistoryQuery(chatIdentifier, limit);
  const state = useSQL<ChatMessage[]>(DB_PATH, sql, { execute });
  return { ...state, data: state.data ?? [] };
}
