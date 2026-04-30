import { useState } from "react";
import { z } from "zod";
import { search, random } from "node-emoji";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("Keyword to search for, e.g. 'cat', 'fire', 'happy'. Empty for a random emoji."),
  limit: z
    .number()
    .int()
    .optional()
    .describe("Maximum number of results to show. Defaults to 20."),
});

type Props = z.infer<typeof schema>;

interface Match {
  emoji: string;
  name: string;
}

function randomMatches(count: number): Match[] {
  const out: Match[] = [];
  for (let i = 0; i < count; i++) {
    const r = random();
    out.push({ emoji: r.emoji, name: r.name });
  }
  return out;
}

function doSearch(query: string, limit: number): Match[] {
  if (!query.trim()) {
    return randomMatches(Math.min(limit, 6));
  }
  return search(query.trim().toLowerCase()).slice(0, limit);
}

function buildMarkdown(matches: Match[], query: string): string {
  if (matches.length === 0) return `_No emoji found for "${query}"._`;
  const lines: string[] = [];
  if (query.trim()) {
    lines.push(`### ${matches.length} match${matches.length === 1 ? "" : "es"} for "${query}"`);
  } else {
    lines.push(`### Random emoji`);
  }
  lines.push("");
  for (const m of matches) {
    lines.push(`- ${m.emoji} \`:${m.name}:\``);
  }
  return lines.join("\n");
}

function EmojiSearch(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query ?? "");
  const limit = Math.max(1, Math.min(100, props.limit ?? 20));
  const [matches, setMatches] = useState<Match[]>(() => doSearch(props.query ?? "", limit));

  function onSearch() {
    setMatches(doSearch(query, limit));
  }

  function onRandom() {
    setMatches(randomMatches(6));
  }

  function onCopyAll() {
    const allEmojis = matches.map((m) => m.emoji).join("");
    closeWidget(allEmojis || "(no matches)");
  }

  function onDone() {
    if (matches.length === 0) {
      closeWidget("No emoji matched.");
      return;
    }
    closeWidget(matches.map((m) => `${m.emoji} :${m.name}:`).join(", "));
  }

  return (
    <Form
      header={<CardHeader title="Emoji Search" iconBundleId="com.apple.Emoji" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Search" onSubmit={onSearch} style="primary" />
          <Action title="Random" onAction={onRandom} style="secondary" />
          <Action title="Copy All" onAction={onCopyAll} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(matches, query)} />
      <Form.TextField name="query" label="Keyword" value={query} onChange={setQuery} />
    </Form>
  );
}

const EmojiSearchWidget = defineWidget({
  name: "search_emoji",
  description:
    "Search for emoji by keyword (e.g. 'cat', 'fire'). Empty query returns random picks. Returns the emoji glyph and shortcode.",
  schema,
  component: EmojiSearch,
});

export default EmojiSearchWidget;
