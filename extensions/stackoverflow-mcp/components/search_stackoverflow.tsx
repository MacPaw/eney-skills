import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const SORTS = ["relevance", "votes", "activity", "creation"] as const;
type Sort = (typeof SORTS)[number];

const schema = z.object({
  query: z.string().describe("Search query, e.g. 'async await foreach'."),
  tag: z.string().optional().describe("Optional tag filter, e.g. 'javascript'."),
  sort: z.enum(SORTS).optional().describe("Sort order. Defaults to 'relevance'."),
});

type Props = z.infer<typeof schema>;

interface Question {
  id: number;
  title: string;
  link: string;
  score: number;
  answerCount: number;
  isAnswered: boolean;
  hasAccepted: boolean;
  tags: string[];
  ownerName: string;
  viewCount: number;
}

interface RawItem {
  question_id: number;
  title: string;
  link: string;
  score: number;
  answer_count: number;
  is_answered: boolean;
  accepted_answer_id?: number;
  tags?: string[];
  owner?: { display_name?: string };
  view_count?: number;
}

async function search(query: string, tag: string | undefined, sort: Sort): Promise<Question[]> {
  const params = new URLSearchParams({
    order: "desc",
    sort,
    q: query,
    site: "stackoverflow",
    pagesize: "15",
  });
  if (tag) params.set("tagged", tag);
  // Stack Exchange API returns gzipped responses; fetch handles decompression natively.
  const res = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${params.toString()}`);
  if (!res.ok) throw new Error(`Stack Exchange API error ${res.status}`);
  const data = (await res.json()) as { items?: RawItem[]; error_message?: string };
  if (data.error_message) throw new Error(data.error_message);
  return (data.items ?? []).map((it) => ({
    id: it.question_id,
    title: decodeEntities(it.title),
    link: it.link,
    score: it.score,
    answerCount: it.answer_count,
    isAnswered: it.is_answered,
    hasAccepted: typeof it.accepted_answer_id === "number",
    tags: it.tags ?? [],
    ownerName: it.owner?.display_name ?? "anonymous",
    viewCount: it.view_count ?? 0,
  }));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "…");
}

function buildMarkdown(qs: Question[], query: string, tag?: string): string {
  if (qs.length === 0) return `_No results for "${query}"._`;
  const lines: string[] = [];
  lines.push(`### ${qs.length} result${qs.length === 1 ? "" : "s"} for "${query}"${tag ? ` (tagged \`${tag}\`)` : ""}`);
  lines.push("");
  qs.forEach((q, i) => {
    const accepted = q.hasAccepted ? "✅" : q.isAnswered ? "💬" : "❓";
    lines.push(`${i + 1}. ${accepted} [${q.title}](${q.link})`);
    lines.push(
      `   _${q.score}▲ · ${q.answerCount} answer${q.answerCount === 1 ? "" : "s"} · ${q.viewCount.toLocaleString()} views · by ${q.ownerName}_`,
    );
    if (q.tags.length > 0) {
      lines.push(`   ${q.tags.map((t) => `\`${t}\``).join(" · ")}`);
    }
  });
  return lines.join("\n");
}

function StackOverflow(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query);
  const [tag, setTag] = useState(props.tag ?? "");
  const [sort, setSort] = useState<Sort>(props.sort ?? "relevance");
  const [results, setResults] = useState<Question[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    search(query, tag.trim() || undefined, sort)
      .then((q) => {
        if (cancelled) return;
        setResults(q);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount, sort]);

  function onSearch() {
    setReloadCount((c) => c + 1);
  }

  function onSetSort(s: Sort) {
    setSort(s);
  }

  function onDone() {
    if (results.length === 0) {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : `No results for "${query}".`);
      return;
    }
    const lines = results.map((q, i) => `${i + 1}. ${q.title} — ${q.score}▲ ${q.answerCount} answers ${q.hasAccepted ? "(accepted)" : ""} ${q.link}`);
    closeWidget(`Stack Overflow "${query}":\n${lines.join("\n")}`);
  }

  const markdown =
    status === "loading"
      ? "_Searching Stack Overflow…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : buildMarkdown(results, query, tag.trim() || undefined);

  return (
    <Form
      header={<CardHeader title={`Stack Overflow — ${sort}`} iconBundleId="com.apple.dt.Xcode" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Search" onSubmit={onSearch} style="primary" />
          <Action title="Relevance" onAction={() => onSetSort("relevance")} style="secondary" />
          <Action title="Votes" onAction={() => onSetSort("votes")} style="secondary" />
          <Action title="Activity" onAction={() => onSetSort("activity")} style="secondary" />
          <Action title="Newest" onAction={() => onSetSort("creation")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="query" label="Query" value={query} onChange={setQuery} />
      <Form.TextField name="tag" label="Tag (optional, e.g. javascript)" value={tag} onChange={setTag} />
    </Form>
  );
}

const StackOverflowWidget = defineWidget({
  name: "search_stackoverflow",
  description:
    "Search Stack Overflow questions via the Stack Exchange API (no key for this volume). Each result shows score, answer count, view count, accepted-answer flag, tags, and the asker's display name. Optional tag filter and sort modes (relevance/votes/activity/creation).",
  schema,
  component: StackOverflow,
});

export default StackOverflowWidget;
