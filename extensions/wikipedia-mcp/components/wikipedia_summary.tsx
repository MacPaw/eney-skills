import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  query: z.string().describe("Wikipedia article title or search query, e.g. 'Albert Einstein', 'Theory of relativity'."),
  language: z
    .string()
    .optional()
    .describe("Wikipedia language code (ISO 639-1), e.g. 'en', 'de', 'fr', 'uk'. Defaults to 'en'."),
});

type Props = z.infer<typeof schema>;

const USER_AGENT = "eney-skills-mcp/1.0 (https://github.com/MacPaw/eney-skills)";

interface SummaryData {
  title: string;
  description?: string;
  extract: string;
  pageUrl: string;
  thumbnailUrl?: string;
}

async function searchTitle(query: string, lang: string): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json() as [string, string[], string[], string[]];
  if (Array.isArray(data) && Array.isArray(data[1]) && data[1].length > 0) {
    return data[1][0];
  }
  return null;
}

async function fetchSummary(query: string, lang: string): Promise<SummaryData> {
  // Try the title directly first
  const directTitle = query.trim().replace(/ /g, "_");
  let res = await fetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(directTitle)}`,
    { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } },
  );

  if (res.status === 404) {
    // Fall back to opensearch
    const found = await searchTitle(query, lang);
    if (!found) throw new Error(`No Wikipedia article found for "${query}"`);
    res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(found.replace(/ /g, "_"))}`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } },
    );
  }

  if (!res.ok) throw new Error(`Wikipedia API error ${res.status}`);

  const data = await res.json() as {
    title: string;
    description?: string;
    extract: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
    type?: string;
  };

  if (data.type === "disambiguation") {
    throw new Error(`"${data.title}" is a disambiguation page. Try a more specific query.`);
  }

  return {
    title: data.title,
    description: data.description,
    extract: data.extract ?? "(No summary available.)",
    pageUrl: data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/ /g, "_"))}`,
    thumbnailUrl: data.thumbnail?.source,
  };
}

function Wikipedia(props: Props) {
  const closeWidget = useCloseWidget();
  const lang = (props.language ?? "en").toLowerCase();
  const [query, setQuery] = useState(props.query);
  const [data, setData] = useState<SummaryData | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setStatus("error");
      setErrorMsg("Empty query.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetchSummary(query, lang)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onSearch() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (data) {
      closeWidget(
        `**${data.title}**${data.description ? ` (${data.description})` : ""}\n\n${data.extract}\n\n${data.pageUrl}`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Searching Wikipedia…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : data
          ? [
              data.thumbnailUrl ? `![${data.title}](${data.thumbnailUrl})` : "",
              `### ${data.title}`,
              data.description ? `_${data.description}_` : "",
              ``,
              data.extract,
              ``,
              `[Open on Wikipedia](${data.pageUrl})`,
            ]
              .filter(Boolean)
              .join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title={`Wikipedia (${lang})`} iconBundleId="com.apple.Safari" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Search" onSubmit={onSearch} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="query"
        label="Article or search term"
        value={query}
        onChange={setQuery}
      />
    </Form>
  );
}

const WikipediaWidget = defineWidget({
  name: "wikipedia_summary",
  description:
    "Fetch a Wikipedia article summary using the REST summary API. Falls back to opensearch when the exact title is not found. Supports any Wikipedia language code.",
  schema,
  component: Wikipedia,
});

export default WikipediaWidget;
