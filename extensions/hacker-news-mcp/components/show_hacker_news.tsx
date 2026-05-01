import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const FEEDS = ["top", "new", "best", "ask", "show", "job"] as const;

const schema = z.object({
  feed: z.enum(FEEDS).optional().describe("Which list to show. Defaults to 'top'."),
  limit: z.number().int().optional().describe("How many stories to display. Defaults to 15. Max 30."),
});

type Props = z.infer<typeof schema>;

interface Story {
  id: number;
  title: string;
  url?: string;
  by: string;
  score: number;
  descendants?: number;
  time: number;
  type: string;
}

const FEED_PATH: Record<string, string> = {
  top: "topstories",
  new: "newstories",
  best: "beststories",
  ask: "askstories",
  show: "showstories",
  job: "jobstories",
};

async function fetchIds(feed: string): Promise<number[]> {
  const url = `https://hacker-news.firebaseio.com/v0/${FEED_PATH[feed]}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error ${res.status}`);
  return (await res.json()) as number[];
}

async function fetchStory(id: number): Promise<Story | null> {
  const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
  if (!res.ok) return null;
  return (await res.json()) as Story | null;
}

async function fetchStories(feed: string, limit: number): Promise<Story[]> {
  const ids = await fetchIds(feed);
  const slice = ids.slice(0, Math.max(1, Math.min(30, limit)));
  const stories = await Promise.all(slice.map(fetchStory));
  return stories.filter((s): s is Story => s !== null);
}

function ago(seconds: number): string {
  const diff = Math.max(1, Math.floor(Date.now() / 1000) - seconds);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function hostname(url: string | undefined): string {
  if (!url) return "news.ycombinator.com";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

function buildMarkdown(stories: Story[], feed: string): string {
  if (stories.length === 0) return "_No stories._";
  const lines: string[] = [];
  lines.push(`### Hacker News — ${feed}`);
  lines.push("");
  stories.forEach((s, i) => {
    const link = s.url ?? `https://news.ycombinator.com/item?id=${s.id}`;
    const comments = `https://news.ycombinator.com/item?id=${s.id}`;
    const meta = `${s.score}▲ · ${s.descendants ?? 0}💬 · ${ago(s.time)} · ${s.by} · ${hostname(s.url)}`;
    lines.push(`${i + 1}. [${s.title}](${link})`);
    lines.push(`   _${meta}_ · [comments](${comments})`);
  });
  return lines.join("\n");
}

function HackerNews(props: Props) {
  const closeWidget = useCloseWidget();
  const [feed, setFeed] = useState<NonNullable<Props["feed"]>>(props.feed ?? "top");
  const limit = Math.max(1, Math.min(30, props.limit ?? 15));
  const [stories, setStories] = useState<Story[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchStories(feed, limit)
      .then((s) => {
        if (cancelled) return;
        setStories(s);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount, feed]);

  function onRefresh() {
    setReloadCount((c) => c + 1);
  }

  function onSetFeed(f: NonNullable<Props["feed"]>) {
    setFeed(f);
  }

  function onDone() {
    if (stories.length === 0) {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
      return;
    }
    const lines = stories.map((s, i) => `${i + 1}. ${s.title} — ${s.score}▲ ${s.descendants ?? 0}💬 (${s.url ?? `https://news.ycombinator.com/item?id=${s.id}`})`);
    closeWidget(`HN ${feed}:\n${lines.join("\n")}`);
  }

  const markdown =
    status === "loading"
      ? "_Loading…_ 🔥"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : buildMarkdown(stories, feed);

  return (
    <Form
      header={<CardHeader title={`Hacker News — ${feed}`} iconBundleId="com.apple.Safari" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={onRefresh} style="primary" />
          <Action title="Top" onAction={() => onSetFeed("top")} style="secondary" />
          <Action title="New" onAction={() => onSetFeed("new")} style="secondary" />
          <Action title="Best" onAction={() => onSetFeed("best")} style="secondary" />
          <Action title="Ask" onAction={() => onSetFeed("ask")} style="secondary" />
          <Action title="Show" onAction={() => onSetFeed("show")} style="secondary" />
          <Action title="Jobs" onAction={() => onSetFeed("job")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const HackerNewsWidget = defineWidget({
  name: "show_hacker_news",
  description:
    "Browse Hacker News top, new, best, ask, show, or job stories. Each entry shows score, comment count, age, author, and source domain. Sourced from the official HN Firebase API (no key).",
  schema,
  component: HackerNews,
});

export default HackerNewsWidget;
