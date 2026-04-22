import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import { z } from "zod";

import { countConversations, readConversations } from "./helpers/db.js";
import {
  addItem,
  buildAgentPrompt,
  completeSession,
  logStep,
  searchContext,
  updateScore,
} from "./helpers/storage.js";
import ReflectionDashboard from "./components/reflection-dashboard.js";

const server = new McpServer(
  { name: "reflect-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);

// ─── UIX Widget ───────────────────────────────────────────────────────────────

uixServer.registerWidget(ReflectionDashboard);

// ─── Reflection entrypoint ────────────────────────────────────────────────────
// Returns a structured ReAct prompt. The calling agent (Claude) executes it
// step-by-step using the atomic tools below. No external LLM needed — eney
// is the inference engine.

server.tool(
  "reflection_start",
  "Start a reflection session. Returns a structured agent prompt to guide analysis of conversation history. The calling agent should follow the returned instructions and use the atomic reflection tools to discover patterns, habits, and preferences. Open the `reflection_dashboard` widget to monitor progress and review results.",
  {
    days_back: z
      .number()
      .optional()
      .describe("Days of conversation history to analyze. Default: 30."),
    focus: z
      .string()
      .optional()
      .describe(
        "Optional focus area, e.g. 'coding habits', 'communication style', 'repeated workflows'. Default: all patterns.",
      ),
  },
  async ({ days_back = 30, focus }) => {
    const focusText = focus ?? "all patterns, habits, and preferences";
    const stats = countConversations(days_back);
    const prompt = buildAgentPrompt(days_back, focusText);

    return {
      content: [
        {
          type: "text",
          text:
            `Found ${stats.chats} conversations (${stats.messages} messages) in the last ${days_back} days.\n\n` +
            prompt,
        },
      ],
    };
  },
);

// ─── Read conversations ───────────────────────────────────────────────────────

server.tool(
  "reflection_read_conversations",
  "Read recent conversations from the eney app database for reflection analysis. Returns structured conversation data grouped by chat.",
  {
    days_back: z
      .number()
      .optional()
      .describe("Days of history to read. Default: 30."),
    limit: z
      .number()
      .optional()
      .describe("Max total messages to return. Default: 400."),
  },
  async ({ days_back = 30, limit = 400 }) => {
    const conversations = readConversations(days_back, limit);
    const summary =
      `${conversations.length} conversations, ` +
      `${conversations.reduce((n, c) => n + c.messages.length, 0)} messages`;
    return {
      content: [
        {
          type: "text",
          text: `${summary}\n\n${JSON.stringify(conversations, null, 2)}`,
        },
      ],
    };
  },
);

// ─── Log step ─────────────────────────────────────────────────────────────────

server.tool(
  "reflection_log_step",
  "Log a progress step during reflection. The reflection_dashboard widget polls this and shows live status. Call with status 'running' when starting a step, 'done' when finished, 'error' on failure.",
  {
    description: z
      .string()
      .describe("Human-readable description of the current step."),
    status: z
      .enum(["running", "done", "error"])
      .optional()
      .describe("Step status. Default: 'done'."),
  },
  async ({ description, status = "done" }) => {
    logStep(description, status);
    return { content: [{ type: "text", text: `Step logged: [${status}] ${description}` }] };
  },
);

// ─── Add item (actor phase) ───────────────────────────────────────────────────

server.tool(
  "reflection_add_item",
  "Add a reflection item discovered during analysis (actor phase). Returns the item ID needed for reflection_update_score.",
  {
    title: z.string().describe("Short, specific title (e.g. 'Prefers TypeScript strict mode')."),
    type: z
      .enum(["memory", "skill_request", "preference", "communication_style", "habit"])
      .describe(
        "Category: memory=user facts, skill_request=automatable workflow, preference=response style, communication_style=how user writes, habit=recurring behavior.",
      ),
    content: z
      .string()
      .describe("1–3 sentences: specific insight with frequency and context."),
    evidence: z
      .array(z.string())
      .optional()
      .describe("Direct quotes from conversations supporting this insight."),
    actor_score: z
      .number()
      .min(0)
      .max(10)
      .describe(
        "Initial quality score 0–10: (specificity + recurrence + actionability) / 3. Will be updated by critic phase.",
      ),
    is_internal: z
      .boolean()
      .optional()
      .describe(
        "True if this is an agent-adaptation insight (how AI should behave). False if user-visible. skill_request always goes to skill-requests.md regardless.",
      ),
  },
  async ({ title, type, content, evidence, actor_score, is_internal }) => {
    const id = addItem({
      title,
      type,
      content,
      evidence: evidence ?? [],
      actor_score,
      is_internal: is_internal ?? false,
    });
    return {
      content: [
        {
          type: "text",
          text: `Item added (id: ${id}). Use reflection_update_score to set critic_score.`,
        },
      ],
    };
  },
);

// ─── Update score (critic phase) ─────────────────────────────────────────────

server.tool(
  "reflection_update_score",
  "Re-evaluate an item's quality score (critic phase). Items with final score < 6 are auto-dropped when reflection_complete is called. Be strict — penalize vague or single-occurrence items.",
  {
    item_id: z.string().describe("ID returned by reflection_add_item."),
    critic_score: z
      .number()
      .min(0)
      .max(10)
      .describe("Honest re-assessment score 0–10. Takes priority over actor_score."),
    critic_reasoning: z
      .string()
      .optional()
      .describe("Brief reasoning for the score. Shown in review UI."),
  },
  async ({ item_id, critic_score, critic_reasoning }) => {
    updateScore(item_id, critic_score, critic_reasoning);
    return {
      content: [
        {
          type: "text",
          text: `Score updated: ${item_id} → ${critic_score}/10${critic_reasoning ? ` (${critic_reasoning})` : ""}`,
        },
      ],
    };
  },
);

// ─── Complete session ─────────────────────────────────────────────────────────

server.tool(
  "reflection_complete",
  "Mark the reflection session complete. Items with final score < 6 are automatically dropped. The reflection_dashboard widget will switch to review mode.",
  {
    summary: z
      .string()
      .optional()
      .describe("Brief summary shown in the review UI, e.g. 'Found 9 items: 2 skill requests, 4 preferences, 3 habits. Dropped 3 low-score items.'"),
  },
  async ({ summary }) => {
    completeSession(summary);
    return {
      content: [
        {
          type: "text",
          text:
            "Session complete. Open `reflection_dashboard` to review and approve/reject items.\n" +
            (summary ? `Summary: ${summary}` : ""),
        },
      ],
    };
  },
);

// ─── Load context ─────────────────────────────────────────────────────────────
// Generic name so it surfaces in tool search for any context-loading need.

server.tool(
  "load_context",
  "Search stored reflections (user preferences, habits, skill requests, agent-adaptation insights) by keyword query. Use at the start of sessions or tasks to load relevant context about the user. Returns matching sections from reflection files.",
  {
    query: z
      .string()
      .describe(
        "Search terms to match against stored reflections, e.g. 'TypeScript testing', 'communication style', 'project setup'.",
      ),
  },
  async ({ query }) => {
    const results = searchContext(query);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No stored reflections match "${query}". Run reflection_start to build context.`,
          },
        ],
      };
    }

    const formatted = results
      .map(
        (r) =>
          `### Source: ${r.source}\n\n` + r.matches.join("\n\n---\n\n"),
      )
      .join("\n\n===\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Context loaded (query: "${query}"):\n\n${formatted}`,
        },
      ],
    };
  },
);

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Reflect MCP Server running on stdio");
}

main().catch(console.error);
