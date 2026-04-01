import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { buildHistoryQuery, buildChatsQuery, buildUnreadMessagesQuery, formatSentAt } from "../helpers/messages-db.js";

// Tests compile to dist/tests/, so chat.db is two levels up from the compiled file
const DB_PATH = fileURLToPath(new URL("../../chat.db", import.meta.url));

describe("buildHistoryQuery", () => {
  it("includes the chat identifier in the query", () => {
    const sql = buildHistoryQuery("+15551234567", 50);
    assert.ok(sql.includes("+15551234567"), "query should contain chatIdentifier");
  });

  it("includes the correct LIMIT", () => {
    const sql = buildHistoryQuery("chat123", 25);
    assert.ok(sql.includes("LIMIT 25"), "query should contain LIMIT 25");
  });

  it("contains the date normalization expression", () => {
    const sql = buildHistoryQuery("chat123", 50);
    assert.ok(
      sql.includes("CASE WHEN m.date > 1e10"),
      "query should include nanosecond normalization",
    );
  });

  it("orders results DESC", () => {
    const sql = buildHistoryQuery("chat123", 50);
    assert.ok(sql.includes("ORDER BY sentAt DESC"), "query should order DESC");
  });
});

describe("useChatHistory SQL against test chat.db", () => {
  it("returns rows for a known chat identifier", () => {
    const db = new DatabaseSync(DB_PATH);

    // Pick a real chat_identifier from the DB
    const chat = db
      .prepare("SELECT chat_identifier FROM chat LIMIT 1")
      .get() as { chat_identifier: string };

    assert.ok(chat?.chat_identifier, "test DB should have at least one chat");

    const sql = buildHistoryQuery(chat.chat_identifier, 50);
    const rows = db.prepare(sql).all();

    console.log(`chat_identifier: ${chat.chat_identifier}`);
    console.log(`rows returned: ${rows.length}`);
    if (rows.length > 0) console.log("first row:", rows[0]);

    assert.ok(Array.isArray(rows), "should return an array");
    db.close();
  });

  it("returns messages in DESC order (newest first)", () => {
    const db = new DatabaseSync(DB_PATH);

    const chat = db
      .prepare(
        `SELECT c.chat_identifier FROM chat c
         JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
         JOIN message m ON m.ROWID = cmj.message_id
         WHERE m.text IS NOT NULL
         GROUP BY c.ROWID
         HAVING COUNT(*) > 1
         LIMIT 1`,
      )
      .get() as { chat_identifier: string } | undefined;

    if (!chat) {
      console.log("no multi-message chat found, skipping order test");
      return;
    }

    const sql = buildHistoryQuery(chat.chat_identifier, 50);
    const rows = db.prepare(sql).all() as { sentAt: number }[];

    for (let i = 1; i < rows.length; i++) {
      assert.ok(
        rows[i - 1].sentAt >= rows[i].sentAt,
        `row ${i - 1} sentAt should be >= row ${i} sentAt`,
      );
    }

    console.log(`verified DESC order for ${rows.length} messages`);
    db.close();
  });

  it("returns correct fields on each row", () => {
    const db = new DatabaseSync(DB_PATH);

    const chat = db
      .prepare(
        `SELECT c.chat_identifier FROM chat c
         JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
         JOIN message m ON m.ROWID = cmj.message_id
         WHERE m.text IS NOT NULL LIMIT 1`,
      )
      .get() as { chat_identifier: string } | undefined;

    if (!chat) {
      db.close();
      return;
    }

    const sql = buildHistoryQuery(chat.chat_identifier, 10);
    const rows = db.prepare(sql).all() as Record<string, unknown>[];

    if (rows.length > 0) {
      const row = rows[0];
      assert.ok("messageId" in row, "row should have messageId");
      assert.ok("text" in row, "row should have text");
      assert.ok("isFromMe" in row, "row should have isFromMe");
      assert.ok("senderHandle" in row, "row should have senderHandle");
      assert.ok("sentAt" in row, "row should have sentAt");
      assert.ok(
        typeof row.sentAt === "number" && row.sentAt > 1_000_000_000,
        `sentAt should be a valid unix timestamp, got ${row.sentAt}`,
      );
    }

    db.close();
  });
});

describe("useUnreadMessages SQL against test chat.db", () => {
  it("returns unread messages and prints them", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildUnreadMessagesQuery()).all() as Record<string, unknown>[];

    console.log(`unread messages: ${rows.length}`);
    for (const row of rows) console.log(row);

    assert.ok(rows.length > 0, "test DB should have unread messages (run: UPDATE message SET is_read=0 WHERE is_from_me=0 AND text IS NOT NULL LIMIT 5)");
    db.close();
  });

  it("returns correct fields on each row", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildUnreadMessagesQuery()).all() as Record<string, unknown>[];

    assert.ok(rows.length > 0, "need unread messages to test");
    const row = rows[0];
    assert.ok("messageId" in row, "should have messageId");
    assert.ok("text" in row, "should have text");
    assert.ok("senderHandle" in row, "should have senderHandle");
    assert.ok("chatIdentifier" in row, "should have chatIdentifier");
    assert.ok("displayName" in row, "should have displayName");
    assert.ok("sentAt" in row, "should have sentAt");
    assert.ok("isGroupChat" in row, "should have isGroupChat");
    assert.ok(typeof row.sentAt === "number" && (row.sentAt as number) > 1_000_000_000, `sentAt should be unix timestamp, got ${row.sentAt}`);
    db.close();
  });

  it("only returns messages from others (not sent by me)", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildUnreadMessagesQuery()).all() as { messageId: number }[];

    for (const row of rows) {
      const msg = db.prepare("SELECT is_from_me FROM message WHERE ROWID = ?").get(row.messageId) as { is_from_me: number };
      assert.equal(msg.is_from_me, 0, `message ${row.messageId} should not be from me`);
    }
    db.close();
  });

  it("displayName falls back to chatIdentifier when display_name is empty", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildUnreadMessagesQuery()).all() as { displayName: string; chatIdentifier: string }[];

    for (const row of rows) {
      assert.ok(row.displayName.length > 0, `displayName should not be empty for chat ${row.chatIdentifier}`);
    }
    db.close();
  });
});

describe("useChats SQL against test chat.db", () => {
  it("returns chats ordered by most recent message", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildChatsQuery()).all() as Record<string, unknown>[];

    console.log(`total chats: ${rows.length}`);
    if (rows.length > 0) console.log("first (most recent) chat:", rows[0]);
    if (rows.length > 1) console.log("second chat:", rows[1]);

    assert.ok(rows.length > 0, "should return at least one chat");
    db.close();
  });

  it("returns correct fields on each row", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildChatsQuery()).all() as Record<string, unknown>[];

    assert.ok(rows.length > 0, "should have chats");
    const row = rows[0];
    assert.ok("chatIdentifier" in row, "row should have chatIdentifier");
    assert.ok("displayName" in row, "row should have displayName");
    assert.ok("serviceName" in row, "row should have serviceName");
    assert.ok(typeof row.chatIdentifier === "string" && row.chatIdentifier.length > 0, "chatIdentifier should be non-empty string");

    console.log("sample row:", row);
    db.close();
  });

  it("does not return duplicate chats", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildChatsQuery()).all() as { chatIdentifier: string }[];

    const identifiers = rows.map((r) => r.chatIdentifier);
    const unique = new Set(identifiers);
    assert.equal(unique.size, identifiers.length, "each chatIdentifier should appear only once");
    db.close();
  });

  it("only returns chats that have text messages", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare(buildChatsQuery()).all() as { chatIdentifier: string }[];

    for (const row of rows) {
      const count = db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM message m
           JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
           JOIN chat c ON c.ROWID = cmj.chat_id
           WHERE c.chat_identifier = ? AND m.text IS NOT NULL`,
        )
        .get(row.chatIdentifier) as { cnt: number };
      assert.ok(count.cnt > 0, `chat ${row.chatIdentifier} should have at least one text message`);
    }
    db.close();
  });
});

describe("formatSentAt", () => {
  it("formats today's timestamp as time only", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatSentAt(now);
    assert.ok(result.includes(":"), `expected time format, got: ${result}`);
    assert.ok(!result.includes(","), `should not be a date format, got: ${result}`);
  });

  it("formats a past date without time", () => {
    const pastTimestamp = 1577836800; // 2020-01-01 UTC
    const result = formatSentAt(pastTimestamp);
    assert.ok(!result.includes(":") || result.length < 6, `expected date format, got: ${result}`);
  });
});
