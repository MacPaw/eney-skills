import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import { z } from "zod";

import { countConversations, readConversations } from "./helpers/db.js";
import { buildAgentPrompt, getLearnedItems, resetAllReflections } from "./helpers/storage.js";
import ReflectionUIReview from "./components/reflection-ui-review.js";
import ReflectionUIShowAll from "./components/reflection-ui-show-all.js";

const server = new McpServer(
  { name: "reflect-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);

// ─── Widgets ──────────────────────────────────────────────────────────────────

uixServer.registerWidget(ReflectionUIReview);    // approve/reject pending items
uixServer.registerWidget(ReflectionUIShowAll);  // show all reflections

// ─── reflection_start ─────────────────────────────────────────────────────────

server.tool(
  "reflection_start",
  "Start a self-reflection session. Returns an agent prompt to follow. Then use reflection_add_item to record findings, and open reflection-ui-review widget to approve/reject them.",
  {
    days_back: z.number().optional().describe("Days of history to analyze. Default: 30."),
    focus: z.string().optional().describe("Optional focus, e.g. 'communication style', 'recurring habits'. Default: all patterns."),
  },
  async ({ days_back = 30, focus }) => {
    const stats = countConversations(days_back);
    const prompt = buildAgentPrompt(days_back, focus ?? "all patterns, habits, and preferences");
    return {
      content: [{
        type: "text",
        text: `${stats.chats} conversations, ${stats.messages} messages in last ${days_back} days.\n\n${prompt}`,
      }],
    };
  },
);

// ─── reflection_read_conversations ────────────────────────────────────────────

server.tool(
  "reflection_read_conversations",
  "Read conversation history from the eney SQLite database for reflection analysis.",
  {
    days_back: z.number().optional().describe("Days of history. Default: 30."),
    limit: z.number().optional().describe("Max messages. Default: 400."),
  },
  async ({ days_back = 30, limit = 400 }) => {
    const conversations = readConversations(days_back, limit);
    const total = conversations.reduce((n, c) => n + c.messages.length, 0);
    return {
      content: [{
        type: "text",
        text: `${conversations.length} conversations, ${total} messages\n\n${JSON.stringify(conversations, null, 2)}`,
      }],
    };
  },
);

// ─── reflection_add_item ──────────────────────────────────────────────────────

server.tool(
  "reflection_add_item",
  "Record a single reflection action item discovered during conversation analysis. Call once per item.",
  {
    title: z.string().describe("Short label, e.g. 'Opens with humor' or 'Morning weather check'."),
    type: z.enum(["preference", "communication_style", "habit", "skill_request", "memory"]).describe("preference=response style, communication_style=tone/humor, habit=recurring behavior, skill_request=missing capability, memory=user facts."),
    content: z.string().describe("2–3 sentences: what was noticed in conversations + what agent/system should do about it."),
    score: z.number().min(0).max(10).describe("Confidence 0–10. 9–10=clear pattern, 7–8=solid, 5–6=a few times, <5=weak."),
    is_internal: z.boolean().optional().describe("True = agent adapts silently. False = proactive/user-visible opportunity. Default false."),
  },
  async ({ title, type, content, score, is_internal }) => {
    const { addItem } = await import("./helpers/storage.js");
    const id = addItem({ title, type, content, score, is_internal: is_internal ?? false });
    return { content: [{ type: "text", text: `Item saved (id: ${id}). Call reflection_add_item again for the next item, then open reflection-review.` }] };
  },
);

// ─── reflection_reset ─────────────────────────────────────────────────────────

server.tool(
  "reflection_reset",
  "Delete all stored reflections and pending items. Start fresh.",
  {},
  async () => {
    resetAllReflections();
    return { content: [{ type: "text", text: "All reflections cleared." }] };
  },
);

// ─── reflection_context ───────────────────────────────────────────────────────

server.tool(
  "reflection_context",
  "Load all learned reflections into context. Call at session start to apply user preferences, habits, and rules.",
  {},
  async () => {
    const learned = getLearnedItems();
    if (learned.length === 0) {
      return {
        content: [{ type: "text", text: "No reflections yet. Run reflection_start to discover patterns." }],
      };
    }

    const internal = learned.filter((i) => i.type !== "skill_request" && i.is_internal);
    const userFacing = learned.filter((i) => i.type !== "skill_request" && !i.is_internal);
    const skillRequests = learned.filter((i) => i.type === "skill_request");

    function fmt(items: typeof learned) {
      return items.map((i) => `### ${i.title}\n*${i.type} · score ${i.score}/10*\n\n${i.content}`).join("\n\n---\n\n");
    }

    const text = [
      `# User Reflection Profile (${learned.length} items)\n`,
      internal.length > 0 ? `## How to Adapt (Internal Rules)\n\n${fmt(internal)}` : "",
      userFacing.length > 0 ? `## Proactive Opportunities\n\n${fmt(userFacing)}` : "",
      skillRequests.length > 0 ? `## Skill Gaps\n\n${fmt(skillRequests)}` : "",
    ].filter(Boolean).join("\n\n");

    return { content: [{ type: "text", text }] };
  },
);

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Reflect MCP Server running on stdio");
}

main().catch(console.error);
