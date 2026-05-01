import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  query: z.string().describe("Search query, e.g. 'fetch', 'array.prototype.map'."),
  locale: z
    .string()
    .optional()
    .describe("MDN locale code, e.g. 'en-US', 'fr', 'ja'. Defaults to 'en-US'."),
});

type Props = z.infer<typeof schema>;

interface Hit {
  title: string;
  url: string;
  summary: string;
  slug: string;
  score: number;
}

interface RawDoc {
  mdn_url: string;
  title: string;
  slug: string;
  summary?: string;
  score?: number;
}

async function search(query: string, locale: string): Promise<Hit[]> {
  if (!query.trim()) return [];
  const url = `https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(query)}&locale=${encodeURIComponent(locale)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MDN search error ${res.status}`);
  const data = (await res.json()) as { documents?: RawDoc[] };
  return (data.documents ?? []).slice(0, 10).map((d) => ({
    title: d.title,
    url: `https://developer.mozilla.org${d.mdn_url}`,
    summary: (d.summary ?? "").trim(),
    slug: d.slug,
    score: d.score ?? 0,
  }));
}

function buildMarkdown(hits: Hit[], query: string): string {
  if (hits.length === 0) return `_No MDN docs match "${query}"._`;
  const lines: string[] = [];
  lines.push(`### ${hits.length} MDN result${hits.length === 1 ? "" : "s"} for "${query}"`);
  lines.push("");
  hits.forEach((h, i) => {
    const summary = h.summary.length > 240 ? h.summary.slice(0, 240) + "…" : h.summary;
    lines.push(`${i + 1}. [${h.title}](${h.url})`);
    lines.push(`   _${h.slug}_`);
    if (summary) lines.push(`   ${summary}`);
  });
  return lines.join("\n");
}

function MdnSearch(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query);
  const [locale, setLocale] = useState(props.locale ?? "en-US");
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    search(query, locale)
      .then((h) => {
        if (cancelled) return;
        setHits(h);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount, locale]);

  function onSearch() {
    setReloadCount((c) => c + 1);
  }

  function onSetLocale(l: string) {
    setLocale(l);
  }

  function onDone() {
    if (hits.length === 0) {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : `No MDN results for "${query}".`);
      return;
    }
    const lines = hits.map((h, i) => `${i + 1}. ${h.title} — ${h.url}`);
    closeWidget(`MDN "${query}":\n${lines.join("\n")}`);
  }

  const markdown =
    status === "loading"
      ? "_Searching MDN…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : buildMarkdown(hits, query);

  return (
    <Form
      header={<CardHeader title={`MDN — ${locale}`} iconBundleId="com.apple.Safari" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Search" onSubmit={onSearch} style="primary" />
          <Action title="en-US" onAction={() => onSetLocale("en-US")} style="secondary" />
          <Action title="fr" onAction={() => onSetLocale("fr")} style="secondary" />
          <Action title="ja" onAction={() => onSetLocale("ja")} style="secondary" />
          <Action title="ru" onAction={() => onSetLocale("ru")} style="secondary" />
          <Action title="zh-CN" onAction={() => onSetLocale("zh-CN")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="query" label="Query" value={query} onChange={setQuery} />
    </Form>
  );
}

const MdnSearchWidget = defineWidget({
  name: "search_mdn",
  description:
    "Search MDN Web Docs via developer.mozilla.org's public search API. Returns the top 10 docs with titles, slugs, summary excerpts, and direct links. Locale-aware (en-US, fr, ja, ru, zh-CN, etc.).",
  schema,
  component: MdnSearch,
});

export default MdnSearchWidget;
