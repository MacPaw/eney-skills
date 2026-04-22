import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const APP_SUPPORT = path.join(
  process.env.HOME!,
  "Library/Application Support/com.macpaw.assistant-macos.client-setapp",
);

export const REFLECTIONS_DIR = path.join(APP_SUPPORT, "reflections");

const STATE_FILE = path.join(REFLECTIONS_DIR, "state.json");
const PENDING_FILE = path.join(REFLECTIONS_DIR, "pending.json");

// Persistent output files — never auto-deleted
export const INTERNAL_FILE = path.join(REFLECTIONS_DIR, "internal.md");
export const USER_FACING_FILE = path.join(REFLECTIONS_DIR, "user-facing.md");
export const SKILL_REQUESTS_FILE = path.join(REFLECTIONS_DIR, "skill-requests.md");

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepStatus = "running" | "done" | "error";

export interface Step {
  id: string;
  description: string;
  status: StepStatus;
  timestamp: string;
}

export type SessionStatus = "idle" | "running" | "complete";

export interface ReflectionState {
  status: SessionStatus;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  steps: Step[];
}

export type ItemType = "memory" | "skill_request" | "preference" | "communication_style" | "habit";
export type ItemStatus = "pending" | "approved" | "rejected";

export interface ReflectionItem {
  id: string;
  title: string;
  type: ItemType;
  content: string;
  evidence: string[];
  actor_score: number;
  critic_score?: number;
  critic_reasoning?: string;
  is_internal: boolean;
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

// ─── State ────────────────────────────────────────────────────────────────────

export function getState(): ReflectionState {
  ensureDir();
  return readJson<ReflectionState>(STATE_FILE, { status: "idle", steps: [] });
}

function saveState(state: ReflectionState) {
  writeJson(STATE_FILE, state);
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export function logStep(description: string, status: StepStatus = "done") {
  const state = getState();
  if (state.status === "idle") {
    state.status = "running";
    state.startedAt = new Date().toISOString();
  }
  const existing = state.steps.find((s) => s.description === description);
  if (existing) {
    existing.status = status;
    existing.timestamp = new Date().toISOString();
  } else {
    state.steps.push({
      id: crypto.randomUUID(),
      description,
      status,
      timestamp: new Date().toISOString(),
    });
  }
  saveState(state);
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function getPendingItems(): ReflectionItem[] {
  ensureDir();
  return readJson<ReflectionItem[]>(PENDING_FILE, []);
}

function savePendingItems(items: ReflectionItem[]) {
  writeJson(PENDING_FILE, items);
}

export function addItem(
  item: Omit<ReflectionItem, "id" | "status" | "createdAt"> & { evidence?: string[] },
): string {
  const items = getPendingItems();
  const { evidence, ...rest } = item;
  const newItem: ReflectionItem = {
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
    evidence: evidence ?? [],
    ...rest,
  };
  items.push(newItem);
  savePendingItems(items);
  return newItem.id;
}

export function updateScore(itemId: string, criticScore: number, criticReasoning?: string) {
  const items = getPendingItems();
  const item = items.find((i) => i.id === itemId);
  if (item) {
    item.critic_score = criticScore;
    if (criticReasoning) item.critic_reasoning = criticReasoning;
  }
  savePendingItems(items);
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export function completeSession(summary?: string) {
  const state = getState();
  state.status = "complete";
  state.completedAt = new Date().toISOString();
  if (summary) state.summary = summary;
  state.steps.forEach((s) => { if (s.status === "running") s.status = "done"; });
  saveState(state);

  // Drop items below score threshold (critic_score takes priority over actor_score)
  const items = getPendingItems();
  const kept = items.filter((i) => (i.critic_score ?? i.actor_score) >= 6);
  savePendingItems(kept);
}

// ─── Apply / Reject ───────────────────────────────────────────────────────────

function appendToMd(file: string, item: ReflectionItem) {
  ensureDir();
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const score = item.critic_score ?? item.actor_score;
  const evidenceBlock = item.evidence.length > 0
    ? "\n\n**Evidence:**\n" + item.evidence.map((e) => `> ${e}`).join("\n\n")
    : "";
  const criticNote = item.critic_reasoning
    ? `\n\n_Critic note: ${item.critic_reasoning}_`
    : "";

  const entry = `\n---\n\n## ${item.title}\n`
    + `*${date} · ${item.type} · score ${score}/10*\n\n`
    + item.content
    + evidenceBlock
    + criticNote
    + "\n";

  if (!fs.existsSync(file)) {
    const header = file.includes("internal")
      ? "# Internal Reflections\n\nAgent-adaptation insights. Updated automatically.\n"
      : file.includes("skill-requests")
      ? "# Skill Requests\n\nWorkflows that could become reusable skills.\n"
      : "# User-Facing Reflections\n\nInsights about user patterns and preferences.\n";
    fs.writeFileSync(file, header, "utf-8");
  }
  fs.appendFileSync(file, entry, "utf-8");
}

export function applyItem(itemId: string) {
  const items = getPendingItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return false;

  item.status = "approved";
  savePendingItems(items);

  if (item.type === "skill_request") {
    appendToMd(SKILL_REQUESTS_FILE, item);
  } else if (item.is_internal) {
    appendToMd(INTERNAL_FILE, item);
  } else {
    appendToMd(USER_FACING_FILE, item);
  }
  return true;
}

export function rejectItem(itemId: string) {
  const items = getPendingItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return false;
  item.status = "rejected";
  savePendingItems(items);
  return true;
}

// Remove all resolved (approved/rejected) items from pending.json.
// Persistent MD files are untouched.
export function cleanupResolved() {
  const items = getPendingItems();
  const stillPending = items.filter((i) => i.status === "pending");
  savePendingItems(stillPending);

  if (stillPending.length === 0) {
    // All done — reset session state to idle
    saveState({ status: "idle", steps: [] });
  }
}

// ─── Context search (for load_context tool) ──────────────────────────────────

export interface ContextResult {
  source: string;
  matches: string[];
}

export function searchContext(query: string): ContextResult[] {
  const files: Array<{ source: string; path: string }> = [
    { source: "internal-reflections", path: INTERNAL_FILE },
    { source: "user-facing-reflections", path: USER_FACING_FILE },
    { source: "skill-requests", path: SKILL_REQUESTS_FILE },
  ];

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results: ContextResult[] = [];

  for (const { source, path: filePath } of files) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8");

    // Split into sections by ## heading
    const sections = content.split(/\n(?=## )/);
    const matched: string[] = [];

    for (const section of sections) {
      const lower = section.toLowerCase();
      if (terms.every((t) => lower.includes(t))) {
        matched.push(section.trim());
      }
    }

    if (matched.length > 0) {
      results.push({ source, matches: matched });
    }
  }

  return results;
}

// ─── Agent prompt ─────────────────────────────────────────────────────────────

export function buildAgentPrompt(daysBack: number, focus: string): string {
  return `# Reflection Agent

You received this prompt by calling \`reflection_start\`. Execute the reflection workflow below using the available tools. This session's goal: analyze the last **${daysBack} days** of conversation history, focusing on **${focus}**.

## Available tools
- \`reflection_read_conversations\` — read conversation history from the local DB
- \`reflection_log_step\` — log a step (shown in the review UI; call with status "running" to start, then "done" to finish)
- \`reflection_add_item\` — record a discovered insight (actor phase)
- \`reflection_update_score\` — re-evaluate an item after adding it (critic phase)
- \`reflection_complete\` — mark session done; items with final score < 6 are auto-dropped

---

## Phase 1 — Read Data

\`\`\`
reflection_log_step("Reading conversation history", "running")
reflection_read_conversations(days_back: ${daysBack}, limit: 400)
reflection_log_step("Reading conversation history", "done")
\`\`\`

---

## Phase 2 — Actor: Discover Patterns

Scan each conversation. For every clear pattern, call:

\`\`\`
reflection_log_step("Analyzing: <brief topic>", "running")
reflection_add_item({
  title: "Short, specific title",
  type: "<type>",           // memory | skill_request | preference | communication_style | habit
  content: "1–3 sentences, specific, includes frequency/context",
  evidence: ["exact quote 1", "exact quote 2"],
  actor_score: 7,           // 1–10 (specificity + recurrence + actionability) / 3
  is_internal: false        // true = agent-adaptation only; false = user-visible
})
reflection_log_step("Analyzing: <brief topic>", "done")
\`\`\`

**What to look for:**
- **memory**: User facts — role, expertise level, project names, recurring tools
- **skill_request**: Workflow repeated 3+ times (scaffold, deploy, search pattern — something automatable)
- **preference**: Response format/length/style the user consistently prefers
- **communication_style**: How the user writes — terse/verbose, technical level, tone, vocabulary
- **habit**: Recurring behavior — always adds tests, always starts with planning, always asks for TypeScript

**is_internal = true** → agent should adapt silently (e.g. "respond tersely")
**is_internal = false** → user should see this insight

---

## Phase 3 — Critic: Re-evaluate Each Item

After adding all items, review them honestly. For each:

\`\`\`
reflection_update_score({
  item_id: "<id returned by reflection_add_item>",
  critic_score: 8,           // your honest re-assessment
  critic_reasoning: "Strong: appears in 5+ chats. Specific and actionable."
})
\`\`\`

**Scoring rubric:**

| Score | Meaning |
|-------|---------|
| 9–10 | Highly specific, strongly evidenced, high-impact, seen 5+ times |
| 7–8 | Good evidence, specific, actionable |
| 5–6 | Borderline: single occurrence or vague phrasing |
| < 5 | Speculative, too generic, no direct evidence |

**Penalty guide:**
- Vague phrasing ("user likes clean code") → −3
- Only one occurrence → −2
- Already obvious / not novel → −1
- No direct evidence quoted → −2

Items ending up < 6 will be auto-dropped. Be strict.

---

## Phase 4 — Complete

\`\`\`
reflection_log_step("Reflection complete", "done")
reflection_complete({
  summary: "Found N items: X skill requests, Y preferences, Z habits. Dropped M low-score items."
})
\`\`\`

---

## Quality bar
- Aim for 5–15 high-quality items. Prefer fewer, better items over many weak ones.
- Skill requests must describe the workflow precisely enough to implement.
- Evidence must be direct quotes, not paraphrases.
- Do not add items about the AI assistant's own behavior — only about the user.
`;
}
