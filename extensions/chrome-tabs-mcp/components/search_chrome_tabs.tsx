import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { listOpenTabs, readBookmarks, activateTab, type OpenTab, type Bookmark } from "../helpers/chrome.js";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("Substring to filter tab titles/URLs (and bookmark names if 'Search bookmarks' is active)."),
  source: z
    .enum(["tabs", "bookmarks"])
    .optional()
    .describe("'tabs' (default) lists open Chrome tabs; 'bookmarks' searches the bookmarks JSON file."),
  profile: z
    .string()
    .optional()
    .describe("Chrome profile directory name when using bookmarks. Defaults to 'Default'."),
});

type Props = z.infer<typeof schema>;

interface State {
  status: "loading" | "done" | "error";
  errorMsg: string;
  tabs: OpenTab[];
  bookmarks: Bookmark[];
}

function filterTabs(tabs: OpenTab[], q: string): OpenTab[] {
  if (!q.trim()) return tabs;
  const needle = q.trim().toLowerCase();
  return tabs.filter(
    (t) => t.title.toLowerCase().includes(needle) || t.url.toLowerCase().includes(needle),
  );
}

function filterBookmarks(bms: Bookmark[], q: string): Bookmark[] {
  if (!q.trim()) return bms.slice(0, 200);
  const needle = q.trim().toLowerCase();
  return bms
    .filter(
      (b) =>
        b.title.toLowerCase().includes(needle) ||
        b.url.toLowerCase().includes(needle) ||
        b.folder.toLowerCase().includes(needle),
    )
    .slice(0, 200);
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function ChromeTabs(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query ?? "");
  const [source, setSource] = useState<NonNullable<Props["source"]>>(props.source ?? "tabs");
  const profile = props.profile ?? "Default";
  const [state, setState] = useState<State>({ status: "loading", errorMsg: "", tabs: [], bookmarks: [] });
  const [reloadCount, setReloadCount] = useState(0);
  const [activatedMsg, setActivatedMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    setActivatedMsg("");
    (async () => {
      try {
        if (source === "tabs") {
          const tabs = await listOpenTabs();
          if (cancelled) return;
          setState({ status: "done", errorMsg: "", tabs, bookmarks: [] });
        } else {
          const bookmarks = await readBookmarks(profile);
          if (cancelled) return;
          setState({ status: "done", errorMsg: "", tabs: [], bookmarks });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
          tabs: [],
          bookmarks: [],
        });
      }
    })();
    return () => { cancelled = true; };
  }, [reloadCount, source, profile]);

  function onSearch() {
    setReloadCount((c) => c + 1);
  }

  function onSetSource(s: NonNullable<Props["source"]>) {
    setSource(s);
  }

  async function onActivateFirst() {
    if (source !== "tabs") {
      setActivatedMsg("⚠️ Switch to Tabs source first.");
      return;
    }
    const matches = filterTabs(state.tabs, query);
    if (matches.length === 0) {
      setActivatedMsg("⚠️ No matching tab.");
      return;
    }
    const t = matches[0];
    try {
      await activateTab(t.windowIndex, t.tabIndex);
      setActivatedMsg(`✅ Activated ${t.title || t.url}`);
    } catch (err) {
      setActivatedMsg(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    if (source === "tabs") {
      const matches = filterTabs(state.tabs, query).slice(0, 30);
      if (matches.length === 0) {
        closeWidget(`No matching open tabs for "${query}".`);
        return;
      }
      closeWidget(
        `${matches.length} tab${matches.length === 1 ? "" : "s"} matching "${query}":\n` +
        matches.map((t) => `- ${t.title} — ${t.url}`).join("\n"),
      );
    } else {
      const matches = filterBookmarks(state.bookmarks, query).slice(0, 30);
      if (matches.length === 0) {
        closeWidget(`No matching bookmarks for "${query}".`);
        return;
      }
      closeWidget(
        `${matches.length} bookmark${matches.length === 1 ? "" : "s"} matching "${query}":\n` +
        matches.map((b) => `- ${b.title} (${b.folder}) — ${b.url}`).join("\n"),
      );
    }
  }

  let markdown: string;
  if (state.status === "loading") {
    markdown = "_Loading…_";
  } else if (state.status === "error") {
    markdown = `**Error:** ${state.errorMsg}`;
  } else if (source === "tabs") {
    const matches = filterTabs(state.tabs, query);
    const lines: string[] = [];
    lines.push(`### Open tabs — ${matches.length} of ${state.tabs.length}${query.trim() ? ` matching "${query}"` : ""}`);
    if (activatedMsg) {
      lines.push("");
      lines.push(`> ${activatedMsg}`);
    }
    lines.push("");
    matches.slice(0, 60).forEach((t, i) => {
      lines.push(`${i + 1}. [${t.title || host(t.url) || t.url}](${t.url})`);
      lines.push(`   _W${t.windowIndex}/T${t.tabIndex} · ${host(t.url)}_`);
    });
    if (matches.length > 60) lines.push(`\n_…and ${matches.length - 60} more_`);
    markdown = lines.join("\n");
  } else {
    const matches = filterBookmarks(state.bookmarks, query);
    const lines: string[] = [];
    lines.push(
      `### Bookmarks — ${matches.length}${query.trim() ? ` matching "${query}"` : ""} _(profile: ${profile})_`,
    );
    lines.push("");
    matches.forEach((b, i) => {
      lines.push(`${i + 1}. [${b.title}](${b.url})`);
      if (b.folder) lines.push(`   _${b.folder} · ${host(b.url)}_`);
    });
    markdown = lines.join("\n");
  }

  return (
    <Form
      header={<CardHeader title={source === "tabs" ? "Chrome Tabs" : "Chrome Bookmarks"} iconBundleId="com.google.Chrome" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Search" onSubmit={onSearch} style="primary" />
          <Action title="Tabs" onAction={() => onSetSource("tabs")} style="secondary" />
          <Action title="Bookmarks" onAction={() => onSetSource("bookmarks")} style="secondary" />
          <Action title="Activate first match" onAction={onActivateFirst} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="query" label="Filter" value={query} onChange={setQuery} />
    </Form>
  );
}

const ChromeTabsWidget = defineWidget({
  name: "search_chrome_tabs",
  description:
    "Search open Google Chrome tabs (via AppleScript) or bookmarks (read locally from the Bookmarks JSON file). Filters by title and URL substring. The 'Activate first match' action focuses the first matching tab.",
  schema,
  component: ChromeTabs,
});

export default ChromeTabsWidget;
