import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const APP_SUPPORT = path.join(
  process.env.HOME!,
  "Library/Application Support/com.macpaw.assistant-macos.client-setapp",
);

export const REFLECTIONS_DIR = path.join(APP_SUPPORT, "reflections");

const PENDING_FILE = path.join(REFLECTIONS_DIR, "pending.json");
const LEARNED_FILE = path.join(REFLECTIONS_DIR, "learned.json");
const INTERNAL_FILE = path.join(REFLECTIONS_DIR, "internal.md");
const USER_FACING_FILE = path.join(REFLECTIONS_DIR, "user-facing.md");
const SKILL_REQUESTS_FILE = path.join(REFLECTIONS_DIR, "skill-requests.md");

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemType =
  | "preference"        // how user likes responses formatted/styled
  | "communication_style" // how user communicates, tone, humor, brevity
  | "habit"             // recurring behavior → could automate or proactively offer
  | "skill_request"     // new capability needed (tool, skill, system access)
  | "memory";           // factual info about user (role, tools, projects)

export type ItemStatus = "pending" | "approved" | "rejected";

export interface ReflectionItem {
  id: string;
  title: string;
  type: ItemType;
  content: string;      // summary: what was noticed + what to do about it
  score: number;        // 0–10
  is_internal: boolean; // true = agent adapts silently; false = user-visible / proactive
  status: ItemStatus;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir() {
  fs.mkdirSync(REFLECTIONS_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function getPendingItems(): ReflectionItem[] {
  ensureDir();
  return readJson<ReflectionItem[]>(PENDING_FILE, []);
}

function savePendingItems(items: ReflectionItem[]) {
  writeJson(PENDING_FILE, items);
}

export function addItem(item: Omit<ReflectionItem, "id" | "status" | "createdAt">): string {
  // content is the single summary field
  const items = getPendingItems();
  const newItem: ReflectionItem = {
    ...item,
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  savePendingItems(items);
  return newItem.id;
}

// ─── Apply / Reject ───────────────────────────────────────────────────────────

function appendToMd(file: string, item: ReflectionItem) {
  ensureDir();
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  if (!fs.existsSync(file)) {
    const headers: Record<string, string> = {
      [INTERNAL_FILE]: "# Internal Reflections\n\nHow agent should adapt its behavior.\n",
      [USER_FACING_FILE]: "# User-Facing Reflections\n\nUser patterns and proactive opportunities.\n",
      [SKILL_REQUESTS_FILE]: "# Skill Requests\n\nCapability gaps and automation requests.\n",
    };
    fs.writeFileSync(file, headers[file] ?? "# Reflections\n", "utf-8");
  }

  const entry = `\n---\n\n## ${item.title}\n`
    + `*${date} · ${item.type} · score ${item.score}/10*\n\n`
    + item.content + "\n";

  fs.appendFileSync(file, entry, "utf-8");
}

export function getLearnedItems(): ReflectionItem[] {
  ensureDir();
  return readJson<ReflectionItem[]>(LEARNED_FILE, []);
}

function saveLearnedItems(items: ReflectionItem[]) {
  writeJson(LEARNED_FILE, items);
}

export function applyItem(itemId: string): boolean {
  const items = getPendingItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return false;
  item.status = "approved";
  savePendingItems(items);

  // Write to learned.json (structured, permanent store)
  const learned = getLearnedItems();
  if (!learned.find((l) => l.id === item.id)) {
    learned.push({ ...item, status: "approved" });
    saveLearnedItems(learned);
  }

  // Also keep md files for context loading
  if (item.type === "skill_request") {
    appendToMd(SKILL_REQUESTS_FILE, item);
  } else if (item.is_internal) {
    appendToMd(INTERNAL_FILE, item);
  } else {
    appendToMd(USER_FACING_FILE, item);
  }
  return true;
}

export function rejectItem(itemId: string): boolean {
  const items = getPendingItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return false;
  item.status = "rejected";
  savePendingItems(items);
  return true;
}

export function cleanupResolved() {
  const items = getPendingItems();
  savePendingItems(items.filter((i) => i.status === "pending"));
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetAllReflections() {
  ensureDir();
  for (const f of [PENDING_FILE, LEARNED_FILE, INTERNAL_FILE, USER_FACING_FILE, SKILL_REQUESTS_FILE]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

// ─── Agent prompt ─────────────────────────────────────────────────────────────

export function buildAgentPrompt(daysBack: number, focus: string): string {
  return `# Reflection Agent

Analyze the last **${daysBack} days** of conversation history. Focus: **${focus}**.

Your goal: find **concrete signals** in conversations. Look for BOTH explicit and implicit patterns:

**Explicit:** User states a rule directly
- "Always...", "Never...", "Non-negotiable"
- "Yes, do that", "Exactly"
- "That was too long/short"

**Implicit:** User's behavior repeats without asking
- User opens chats in morning 8/10 times → morning person
- User asks for weather every day without prompting → frequent need
- User requests tests + coverage every time → non-negotiable habit
- User opens 3 chats in a row, then breaks → patterns in work rhythm

Also track:
- Repeated friction (asks same thing 2+ times, workarounds, frustration)
- Blocked attempts (user tries feature that doesn't exist)
- Proactivity gaps (user asks A, then B, then C in sequence → offer all upfront)

Then produce **action items** — specific behaviors to adopt, not descriptions of what user did.

## Workflow

### 1. Read history
Call \`reflection_read_conversations\` with \`days_back: ${daysBack}\`.

### 2. Produce action items
For each signal, call \`reflection_add_item\` once per item.

**Item fields:**
- **title** — what to do (imperative: "Enforce strict TypeScript", "Offer weather + follow-ups", "Request file-access skill")
- **type** — see types below
- **content** — concise rule: what behavior to adopt and when. 1–2 sentences. When possible, reference what user said.
- **score** — 0–10 confidence (how clearly this pattern appeared)
- **is_internal** — true = agent silently adopts rule | false = proactive/user-visible opportunity

**Types:**
- \`preference\` — explicit rule about response style (length, format, tone)
- \`communication_style\` — how user communicates; patterns in tone, humor, directness
- \`habit\` — repeated action → proactivity opportunity (user always asks X after greeting)
- \`skill_request\` — user tried to do Y but feature doesn't exist
- \`memory\` — useful facts (user is in Ukraine, uses TypeScript, etc.)

**Examples (explicit + implicit):**

1. **EXPLICIT: User states rule directly**
   User: "Always use strict TypeScript in projects. Non-negotiable."
   → title: "Enforce strict TypeScript"
   → type: preference | is_internal: true | score: 10
   → content: "User explicitly stated: non-negotiable strict mode. Default all TypeScript projects to strict: true."

2. **IMPLICIT: User does thing repeatedly (without asking)**
   User opens chats 9/10 days in morning (7–9am), rarely afternoon. Never asks for morning help.
   → title: "Offer proactive help in morning"
   → type: habit | is_internal: false | score: 8
   → content: "User consistently opens chats in early morning. Offer morning check-in: 'What's first?' or proactive suggestions."

3. **IMPLICIT: User searches for same thing multiple ways**
   User asks "weather in Lviv", then "Kyiv forecast", then "Ukraine May outlook" in sequence
   → title: "Bundle Ukraine weather queries"
   → type: habit | is_internal: false | score: 9
   → content: "User asks for Ukrainian weather piecemeal (city→city→region). Proactively offer all three together when they ask about weather."

4. **EXPLICIT: Communication feedback user gives**
   User: "Keep responses concise. I prefer terse explanations without fluff."
   → title: "Keep replies short and direct"
   → type: preference | is_internal: true | score: 9
   → content: "User explicitly prefers terse, no-fluff. Skip preamble, use bullets, one idea per line."

5. **EXPLICIT: Blocked attempt (user can't do something)**
   User: "I need to check Mac logs but I can't access them. Can you debug this?"
   → title: "Request Mac system diagnostics"
   → type: skill_request | is_internal: false | score: 9
   → content: "User repeatedly tries to debug macOS (logs, processes, disk) but can't access. Request/build skill for system diagnostics."

6. **EXPLICIT: User agrees on pattern**
   User: "Yeah, exactly. Atomic commits with ticket refs. One per logical change."
   → title: "Create atomic commits"
   → type: preference | is_internal: true | score: 8
   → content: "User agreed: each commit = one logical change, format 'fix(#123): description', imperative mood."

7. **IMPLICIT: User works around missing feature**
   User asks "how do I do X?", I show workaround Y, user uses it. Repeats 3+ times.
   → title: "Build X feature"
   → type: skill_request | is_internal: false | score: 7
   → content: "User repeatedly works around missing feature X using workaround Y. Build X natively so user doesn't need workaround."

**Score guide:**
- 9–10 = explicit rule, clear block/frustration, or repeated 5+ times
- 7–8 = stated 2–3 times or clear pattern
- 5–6 = weak signal, inferred but not explicit
- <5 = don't include

### 3. Open review widget (REQUIRED)
After all \`reflection_add_item\` calls, open the review widget with NO arguments:

\`\`\`
reflection-ui-review()
\`\`\`

It reads the pending queue automatically. Do NOT pass items as arguments. Do NOT summarize in text.

## Quality bar
- **Explicit patterns**: what user said directly (rules, feedback, agreements)
- **Implicit patterns**: what user does repeatedly without asking (habits, workarounds, rhythms)
- Both are valid. A pattern needs evidence: explicit statement, repeated 3+ times, or blocked attempt.
- Titles: imperative actions, not observations. "Enforce X", "Offer Y", "Request Z" — never "User does X".
- Content: **be specific about the signal**. Quote user when explicit. Reference behavior when implicit.
  - Explicit: "User stated...", "User explicitly asked...", "User agreed that..."
  - Implicit: "User does X in 9/10 chats", "User repeatedly searches for A then B", "User works around missing X"
- \`skill_request\`: describe blocked attempt. What did user try? What failed? What do they need?
- Score 9–10: explicit rule or repeated 5+ times | Score 7–8: stated 2–3 times or clear repeated pattern | Score 5–6: weak/inferred
- Skip observations that lack evidence (generic "user likes X" without 3+ instances or explicit statement).
`;
}
