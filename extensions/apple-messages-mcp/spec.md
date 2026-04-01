---
id: apple-messages-mcp
---
# Extension — Apple Messages

## Description

Search iMessage and SMS conversations, read message history, and send messages through the macOS Messages app. Gives the AI assistant full conversational context to help users find, review, and reply to their messages.

---

## Use cases

### Send Message
User asks to send a message. The assistant resolves the contact via a searchable dropdown, shows a form with recipient + message for review, and sends via AppleScript on confirm.

**Triggers:** "text Mom I'll be late", "send John the meeting link"

### Check Unread Messages
User wants to see what's waiting for a reply. The assistant fetches unread messages from `chat.db`, resolves sender names via macOS Contacts, groups by conversation, and displays them in a dropdown + markdown preview. User can switch between conversations.

**Triggers:** "any new messages?", "what did I miss?"

### Reply to a Message
From the unread messages view, user picks a conversation, taps Reply, types a message, and sends it — all without leaving the widget.

**Triggers:** "reply to that" (after viewing unread)

### Open a Chat in Messages
User wants to jump to a conversation in the Messages app. Opens immediately if `chatIdentifier` is provided, otherwise shows a contact picker.

**Triggers:** "open my chat with Sarah", "open Messages"

### AI Summary
User asks for a catch-up. The `closeWidget` context from unread-messages returns a structured markdown summary grouped by chat — no dedicated tool needed.

**Triggers:** "give me a messages summary", "catch me up"

---

## Widgets

### send-message

Form with `ContactSelector` dropdown + message text field. Submit sends via AppleScript.

| Field | Type | Description |
|---|---|---|
| `recipient` | string, optional | Phone number, email, or contact name |
| `message` | string, optional | Message text to send |

- Submit disabled until both fields non-empty
- `isLoading` during send
- `closeWidget`: success message or error string

### open-messages-chat

Auto-opens Messages if `chatIdentifier` provided. Otherwise shows `ContactSelector` to pick a contact, then opens on tap.

| Field | Type | Description |
|---|---|---|
| `chatIdentifier` | string, optional | Phone number or email to open directly |

- `closeWidget`: "Opened Messages chat with {contact}" or "Opened Messages app"

### unread-messages

Multi-view widget: default (list), reply, sent confirmation.

| Field | Type | Description |
|---|---|---|
| `limit` | number, optional | Max unread messages to fetch (default 50) |

**Default view:** `Form.Dropdown` of conversations (grouped by `chatIdentifier`, labeled with resolved contact name + unread count). `Paper` shows messages for selected conversation. Actions: Open Chat, Reply, Done.

**Reply view:** Shows conversation markdown + text field. Send button calls `sendMessage()` via AppleScript.

**Sent view:** Confirmation with "Ok" button returning to default.

**Markdown format** (widget display):
```
*d mon time*

message 1
message 2

*time*

message 3
```
- Messages grouped by minute
- Today: time only. This year: `d mon time`. Older: `d mon year time`
- Empty text messages show attachment filename as `(filename.heic)` or `[attachment]`

**Close context format** (returned to AI):
```
💬 **Contact Name (N unreads)**

*d mon time*

message 1
message 2

---

💬 **Another Contact (M unreads)**

*time*

message 3
```
- Grouped by chat, then by minute within each chat
- Same time formatting rules as widget display

---

## Shared components

### ContactSelector

Searchable `Form.Dropdown` of macOS contacts (phones + emails). Loads all contacts on mount via JXA, flattens into `label: "Name — phone/email"` items.

Props: `value`, `onChange`, `onSelect?`, `initialQuery?`, `label?`

Used by: send-message, open-messages-chat.

---

## Helpers

### run-script.ts

| Export | Signature | Description |
|---|---|---|
| `runScript` | `(script: string) => Promise<string>` | Runs AppleScript via `osascript -e`. Returns trimmed stdout, rejects on non-zero exit. |
| `runJXA` | `(script: string) => Promise<string>` | Runs JXA via `osascript -l JavaScript -e`. Same error handling. |

### contacts.ts

| Export | Signature | Description |
|---|---|---|
| `searchContacts` | `(query: string) => Promise<Contact[]>` | JXA search via `CNContactStore`. Returns `{ name, phones[], emails[] }`. Empty query returns all. |
| `resolveContactNames` | `(identifiers: string[]) => Promise<Map<string, string>>` | Maps phone/email identifiers to contact names. Uses fuzzy phone matching (last 9 digits). |

### messages-actions.ts

| Export | Signature | Description |
|---|---|---|
| `sendMessage` | `(recipient, message) => Promise<string>` | AppleScript: targets iMessage service, gets buddy, sends. Escapes `"` and `\`. |
| `openMessagesChat` | `(chatIdentifier?) => Promise<string>` | AppleScript: activates Messages, optionally opens `messages://{id}`. |
| `buildSendScript` | `(recipient, message) => string` | Returns the AppleScript string (exported for testing). |
| `buildOpenScript` | `(chatIdentifier?) => string` | Returns the AppleScript string (exported for testing). |

### messages-db.ts

**SQL hooks** against `~/Library/Messages/chat.db` via `useSQL` from `@eney/api`.

Date normalization: `CASE WHEN m.date > 1e10 THEN m.date / 1000000000 ELSE m.date END + 978307200`

| Export | Description |
|---|---|
| `useUnreadMessages()` | Unread messages with attachment filenames. Joins `message`, `chat`, `handle`, `attachment`. |
| `useChats()` | All chats ordered by most recent message. |
| `useChatHistory(id, limit, execute)` | Messages for one chat, DESC order. `chatIdentifier` sanitized against injection. |
| `formatSentAt(ts)` | Time for today, "Mon D" for older. |
| `formatGroupTime(ts)` | Time for today, "d mon time" this year, "d mon year time" older. |
| `cleanMessageText(raw, filename?)` | Strips invisible Unicode (U+FFFC etc). Falls back to `(filename)` or `[attachment]`. |
| `buildUnreadMessagesQuery()` | Exported for testing. |
| `buildChatsQuery()` | Exported for testing. |
| `buildHistoryQuery(id, limit)` | Exported for testing. Input sanitized. |

**Interfaces:** `UnreadMessage`, `Chat`, `ChatMessage`.

---

## Data sources

**SQL** — `~/Library/Messages/chat.db` (read-only). Tables: `message`, `chat`, `chat_message_join`, `handle`, `attachment`, `message_attachment_join`.

**JXA** — macOS Contacts framework (`CNContactStore`) for contact search and name resolution.

**AppleScript** — Messages app for sending messages and opening chats.

---

## File structure

```
mcps/apple-messages-mcp/
├── index.ts                     # MCP server, registers 3 widgets
├── manifest.json
├── package.json
├── tsconfig.json
├── chat.db                      # test fixture
├── components/
│   ├── send-message.tsx
│   ├── open-messages-chat.tsx
│   ├── unread-messages.tsx
│   └── contact-selector.tsx     # shared
├── helpers/
│   ├── run-script.ts
│   ├── messages-db.ts
│   ├── messages-actions.ts
│   └── contacts.ts
└── tests/
    ├── messages-db.test.ts
    ├── messages-actions.test.ts
    └── contacts.test.ts
```

---

## Tests

Uses `node:test` + `node:assert/strict`. Run via `npm test`. Tests focus on pure logic — no mocking of DB or shell.

- **messages-db.test.ts** — query building (`buildHistoryQuery`, `buildChatsQuery`, `buildUnreadMessagesQuery`), date normalization, field shapes, ordering. Integration tests against `chat.db` fixture.
- **messages-actions.test.ts** — AppleScript escaping (quotes, backslashes, newlines), `buildSendScript`, `buildOpenScript`.
- **contacts.test.ts** — `searchContacts` filtering, shape validation, empty results.

---

## Permissions

- **Full Disk Access** for reading `chat.db`
- **Contacts** access for JXA contact search
- Messages app must be configured with at least one account

---

## Evals

| Flow | Steps | Expected |
|---|---|---|
| Send message | Open > pick contact > type > submit | Message sent, widget closes with confirmation |
| Open chat | Open > pick contact > tap Open | Messages app opens to that conversation |
| Open chat (auto) | Trigger with `chatIdentifier` | Messages opens directly, no picker |
| Check unread | Open unread-messages | Grouped conversations in dropdown, messages in markdown |
| Switch conversation | Select different dropdown item | Markdown updates to show that conversation |
| Reply inline | From unread > Reply > type > Send | Message sent, "sent" confirmation shown |
| Done / AI summary | Tap Done | Widget closes, returns markdown context grouped by chat |
| No unread | Open when inbox is empty | Shows "No unread messages." |
| Attachment message | Message with image, no text | Shows `(filename.heic)` instead of blank |