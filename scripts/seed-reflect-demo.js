#!/usr/bin/env node
/**
 * Seed eney SQLite database with sample chat records for reflection demo.
 * Creates realistic conversations with patterns for reflect-mcp to discover.
 *
 * Usage: node scripts/seed-reflect-demo.js
 */

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const DB_PATH = join(
  homedir(),
  "Library/Application Support/com.macpaw.assistant-macos.client-setapp/eney-db.sqlite",
);

function uuid() {
  return randomUUID();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const SAMPLE_CONVERSATIONS = [
  {
    title: "TypeScript Project Setup",
    messages: [
      { role: "user", text: "Set up a new TypeScript project with strict mode." },
      {
        role: "assistant",
        text: "Sure! Here's the setup:\n1. `npm init -y`\n2. `npm install -D typescript`\n3. Create tsconfig.json with strict: true\n4. Set up build script",
      },
      { role: "user", text: "Good. Also add ESLint with TypeScript support." },
      {
        role: "assistant",
        text: "Add these packages:\n`npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin`",
      },
      {
        role: "user",
        text: "Always use strict TypeScript in projects. Non-negotiable.",
      },
      {
        role: "assistant",
        text: "Understood. I'll enforce strict mode by default in all TypeScript configs going forward.",
      },
    ],
    createdAt: daysAgo(25),
  },
  {
    title: "Testing Strategy",
    messages: [
      { role: "user", text: "How should I structure tests for this utility?" },
      {
        role: "assistant",
        text: "Use unit tests for logic, integration tests for API calls. Keep tests focused.",
      },
      {
        role: "user",
        text: "Always include tests when writing utilities. Every function should have at least one test.",
      },
      {
        role: "assistant",
        text: "Got it. I'll ensure all new utility functions include tests.",
      },
      {
        role: "user",
        text: "Run tests before pushing. Show me the coverage report.",
      },
      {
        role: "assistant",
        text: "Absolutely. Running tests and checking coverage is now part of my workflow.",
      },
      {
        role: "user",
        text: "Also add test file templates for faster TDD.",
      },
      {
        role: "assistant",
        text: "I can create test scaffolds that you can fill in. Speeds up TDD.",
      },
    ],
    createdAt: daysAgo(20),
  },
  {
    title: "API Integration",
    messages: [
      {
        role: "user",
        text: "I need to fetch data from a REST API. How would you structure this?",
      },
      {
        role: "assistant",
        text: "Create a service module that handles API calls. Use async/await for clean syntax.",
      },
      {
        role: "user",
        text: "Keep responses concise. I prefer terse explanations without fluff.",
      },
      {
        role: "assistant",
        text: "Noted. I'll be concise and skip unnecessary elaboration.",
      },
      {
        role: "user",
        text: "Add error handling and retry logic. Show me the implementation.",
      },
      {
        role: "assistant",
        text: "Retry on timeout/5xx. Exponential backoff. Max 3 attempts.",
      },
    ],
    createdAt: daysAgo(15),
  },
  {
    title: "Documentation & Code Review",
    messages: [
      {
        role: "user",
        text: "Review this PR. Check for code quality, tests, and documentation.",
      },
      {
        role: "assistant",
        text: "Looking at:\n- Code structure (✓ good)\n- Test coverage (⚠ 60%)\n- Docs (✗ missing)",
      },
      {
        role: "user",
        text: "All functions should have JSDoc comments. And tests should exceed 80% coverage.",
      },
      {
        role: "assistant",
        text: "I'll check for JSDoc + 80% coverage in all PRs going forward.",
      },
      {
        role: "user",
        text: "Also add a CHANGELOG entry for user-facing changes.",
      },
      {
        role: "assistant",
        text: "Will include CHANGELOG updates for PRs affecting users.",
      },
    ],
    createdAt: daysAgo(12),
  },
  {
    title: "Performance & Optimization",
    messages: [
      {
        role: "user",
        text: "This query is slow. Optimize it.",
      },
      {
        role: "assistant",
        text: "Add an index on the user_id column. Should drop query time from 500ms to 50ms.",
      },
      {
        role: "user",
        text: "Profile before optimizing. Show me the benchmarks.",
      },
      {
        role: "assistant",
        text: "Running benchmarks first. Here's the baseline profile...",
      },
      {
        role: "user",
        text: "Cache frequently accessed data. Redis is already set up.",
      },
      {
        role: "assistant",
        text: "I'll use Redis for hot data. Key format: `cache:entity:id`.",
      },
    ],
    createdAt: daysAgo(8),
  },
  {
    title: "Git Workflow & Commits",
    messages: [
      {
        role: "user",
        text: "How should I name my branches?",
      },
      {
        role: "assistant",
        text: "Use: feature/description, bugfix/description, or chore/description",
      },
      {
        role: "user",
        text: "Commit messages: imperative, lowercase, under 50 chars. Reference tickets.",
      },
      {
        role: "assistant",
        text: "Got it. Imperatives only. Format: 'fix(#123): description'",
      },
      {
        role: "user",
        text: "Create a new commit for each logical change. No squashing into monolithic commits.",
      },
      {
        role: "assistant",
        text: "Each commit will be atomic and logically distinct.",
      },
    ],
    createdAt: daysAgo(5),
  },
  {
    title: "Frontend & State Management",
    messages: [
      {
        role: "user",
        text: "Should I use Redux or Context API for this app?",
      },
      {
        role: "assistant",
        text: "Context API for local state. Redux if you need time-travel debugging or multiple stores.",
      },
      {
        role: "user",
        text: "Use React hooks. Avoid class components.",
      },
      {
        role: "assistant",
        text: "Hooks only. No class components in new code.",
      },
      {
        role: "user",
        text: "Memoize expensive computations with useMemo.",
      },
      {
        role: "assistant",
        text: "I'll use useMemo for derived state and expensive calculations.",
      },
      {
        role: "user",
        text: "Keep components small and reusable. Single responsibility.",
      },
      {
        role: "assistant",
        text: "Small, focused components. Each handles one concern.",
      },
    ],
    createdAt: daysAgo(3),
  },
  {
    title: "Debugging & Troubleshooting",
    messages: [
      {
        role: "user",
        text: "App crashes on startup. Help me debug.",
      },
      {
        role: "assistant",
        text: "Check: 1) Error logs 2) Network tab 3) Browser console. Share output.",
      },
      {
        role: "user",
        text: "Found it—race condition in async initialization.",
      },
      {
        role: "assistant",
        text: "Fix: await initialization before rendering. Add try/catch.",
      },
      {
        role: "user",
        text: "Add logging at critical points. Help with debugging later.",
      },
      {
        role: "assistant",
        text: "I'll add structured logging (debug level) at key checkpoints.",
      },
    ],
    createdAt: daysAgo(1),
  },
];

function seedDatabase() {
  const db = new DatabaseSync(DB_PATH);

  try {
    console.log(`📝 Seeding database: ${DB_PATH}`);

    let chatCount = 0;
    let messageCount = 0;

    for (const conv of SAMPLE_CONVERSATIONS) {
      const chatId = uuid();
      db.prepare("INSERT INTO main.chat (id, createdAt) VALUES (?, ?)").run(chatId, conv.createdAt);
      chatCount++;

      let turnId = 0;
      for (const msg of conv.messages) {
        const msgId = uuid();
        const messageType = msg.role === "user" ? "user" : "assistant";

        db.prepare(
          "INSERT INTO main.message (id, chatID, turnID, messageType, createdAt) VALUES (?, ?, ?, ?, ?)",
        ).run(msgId, chatId, String(turnId), messageType, conv.createdAt);

        if (msg.role === "user") {
          db.prepare("INSERT INTO main.userMessage (messageID, text) VALUES (?, ?)").run(msgId, msg.text);
        } else {
          db.prepare("INSERT INTO main.assistantMessage (messageID, text) VALUES (?, ?)").run(msgId, msg.text);
        }

        messageCount++;
        turnId++;
      }
    }

    console.log(`✓ Created ${chatCount} conversations`);
    console.log(`✓ Created ${messageCount} messages`);
    console.log(`\n🎯 Sample patterns for reflection_start to discover:`);
    console.log(`  - Prefers TypeScript with strict mode`);
    console.log(`  - Always includes tests (80%+ coverage)`);
    console.log(`  - Terse communication style`);
    console.log(`  - Atomic commits with ticket references`);
    console.log(`  - React hooks only, no class components`);
    console.log(`  - Profile before optimizing`);
    console.log(`  - JSDoc comments required`);
    console.log(`\n✨ Demo data ready. Run reflection_start to analyze.`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    db.close();
  }
}

seedDatabase();
