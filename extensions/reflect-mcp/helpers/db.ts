import { DatabaseSync } from "node:sqlite";

const DB_PATH = `${process.env.HOME}/Library/Application Support/com.macpaw.assistant-macos.client-setapp/eney-db.sqlite`;

export interface ConversationMessage {
  chatId: string;
  messageId: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export interface Conversation {
  chatId: string;
  startedAt: string;
  messages: ConversationMessage[];
}

const MAX_MSG_LEN = 2000;

export function readConversations(daysBack: number, limit: number): Conversation[] {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const rows = db.prepare(`
      SELECT
        m.chatID,
        m.id AS messageID,
        m.createdAt,
        COALESCE(um.text, am.text) AS text,
        CASE WHEN um.messageID IS NOT NULL THEN 'user' ELSE 'assistant' END AS role
      FROM message m
      LEFT JOIN userMessage um ON m.id = um.messageID
      LEFT JOIN assistantMessage am ON m.id = am.messageID
      WHERE m.createdAt >= ?
        AND (um.messageID IS NOT NULL OR am.messageID IS NOT NULL)
        AND COALESCE(um.text, am.text) IS NOT NULL
        AND LENGTH(TRIM(COALESCE(um.text, am.text))) > 0
      ORDER BY m.chatID, m.createdAt ASC
      LIMIT ?
    `).all(cutoff, limit) as Array<{
      chatID: string;
      messageID: string;
      createdAt: string;
      text: string;
      role: "user" | "assistant";
    }>;

    const chatMap = new Map<string, ConversationMessage[]>();
    for (const row of rows) {
      if (!chatMap.has(row.chatID)) chatMap.set(row.chatID, []);
      chatMap.get(row.chatID)!.push({
        chatId: row.chatID,
        messageId: row.messageID,
        role: row.role,
        text: row.text.length > MAX_MSG_LEN
          ? row.text.slice(0, MAX_MSG_LEN) + "…[truncated]"
          : row.text,
        createdAt: row.createdAt,
      });
    }

    return Array.from(chatMap.entries()).map(([chatId, messages]) => ({
      chatId,
      startedAt: messages[0]?.createdAt ?? "",
      messages,
    }));
  } finally {
    db.close();
  }
}

export function countConversations(daysBack: number): { chats: number; messages: number } {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      SELECT
        COUNT(DISTINCT chatID) AS chats,
        COUNT(*) AS messages
      FROM message
      WHERE createdAt >= ?
    `).get(cutoff) as { chats: number; messages: number };
    return result ?? { chats: 0, messages: 0 };
  } finally {
    db.close();
  }
}
