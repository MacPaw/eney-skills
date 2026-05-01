import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional keyword to filter shortcodes (substring match). Empty lists all."),
  limit: z
    .number()
    .int()
    .optional()
    .describe("Max results to display. Defaults to 30."),
});

type Props = z.infer<typeof schema>;

interface Match {
  shortcode: string;
  url: string;
}

let cache: Match[] | null = null;

async function fetchEmoji(): Promise<Match[]> {
  if (cache) return cache;
  const res = await fetch("https://api.github.com/emojis", {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const data = (await res.json()) as Record<string, string>;
  cache = Object.entries(data).map(([shortcode, url]) => ({ shortcode, url }));
  return cache;
}

function GithubEmoji(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query ?? "");
  const limit = Math.max(1, Math.min(200, props.limit ?? 30));
  const [matches, setMatches] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchEmoji()
      .then((all) => {
        if (cancelled) return;
        const q = query.trim().toLowerCase();
        const filtered = q
          ? all.filter((m) => m.shortcode.toLowerCase().includes(q))
          : all;
        setTotal(filtered.length);
        setMatches(filtered.slice(0, limit));
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onSearch() {
    setReloadCount((c) => c + 1);
  }

  function onCopyAll() {
    closeWidget(matches.map((m) => `:${m.shortcode}:`).join(" "));
  }

  function onDone() {
    if (matches.length === 0) {
      closeWidget("No matches.");
      return;
    }
    closeWidget(matches.map((m) => `:${m.shortcode}:`).join(", "));
  }

  let markdown: string;
  if (status === "loading") {
    markdown = "_Loading emoji…_";
  } else if (status === "error") {
    markdown = `**Error:** ${errorMsg}`;
  } else if (matches.length === 0) {
    markdown = `_No GitHub emoji match "${query}"._`;
  } else {
    const lines: string[] = [];
    lines.push(`**${total.toLocaleString()}** match${total === 1 ? "" : "es"}${total > matches.length ? ` · showing first ${matches.length}` : ""}`);
    lines.push("");
    for (const m of matches) {
      lines.push(`![:${m.shortcode}:](${m.url}) \`:${m.shortcode}:\``);
    }
    markdown = lines.join("\n");
  }

  return (
    <Form
      header={<CardHeader title="GitHub Emoji" iconBundleId="com.apple.dt.Xcode" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Search" onSubmit={onSearch} style="primary" />
          <Action title="Copy all shortcodes" onAction={onCopyAll} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="query"
        label="Filter (substring of shortcode)"
        value={query}
        onChange={setQuery}
      />
    </Form>
  );
}

const GithubEmojiWidget = defineWidget({
  name: "search_github_emoji",
  description:
    "Search and list GitHub-flavored emoji shortcodes (the names usable in GitHub Markdown like `:rocket:`). Pulls the canonical list from api.github.com/emojis. Substring match against the shortcode name.",
  schema,
  component: GithubEmoji,
});

export default GithubEmojiWidget;
