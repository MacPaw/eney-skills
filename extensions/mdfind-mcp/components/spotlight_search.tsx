import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { spotlightSearch, fmtBytes, shortPath, type FoundFile } from "../helpers/mdfind.js";

const schema = z.object({
  query: z.string().describe("Spotlight query. Plain text matches content + metadata; use 'kMDItemContentType == \"public.image\"' for raw queries."),
  scope: z
    .string()
    .optional()
    .describe("'home' (search ~), 'all' (whole indexed system), or an absolute path to limit the search to. Defaults to 'home'."),
  filenameMode: z
    .boolean()
    .optional()
    .describe("If true, match against filename only (mdfind -name). Defaults to false (full Spotlight)."),
  limit: z
    .number()
    .int()
    .optional()
    .describe("Max results. Defaults to 30. Max 500."),
});

type Props = z.infer<typeof schema>;

interface State {
  status: "loading" | "done" | "error";
  errorMsg: string;
  results: FoundFile[];
}

function buildMarkdown(state: State, query: string, scope: string, filenameMode: boolean): string {
  if (state.status === "loading") return "_Searching Spotlight…_";
  if (state.status === "error") return `**Error:** ${state.errorMsg}`;
  if (state.results.length === 0) return `_No matches for "${query}" in scope ${scope}._`;
  const lines: string[] = [];
  lines.push(
    `### ${state.results.length} result${state.results.length === 1 ? "" : "s"} — scope **${scope}**${filenameMode ? " · filename only" : ""}`,
  );
  lines.push("");
  state.results.slice(0, 60).forEach((r, i) => {
    const ts = r.modifiedAt ? r.modifiedAt.toISOString().slice(0, 16).replace("T", " ") : "—";
    lines.push(`${i + 1}. **${r.name}** \`${fmtBytes(r.size)}\` _${ts}_`);
    lines.push(`   \`${shortPath(r.parent)}\``);
  });
  if (state.results.length > 60) lines.push(`\n_…and ${state.results.length - 60} more_`);
  return lines.join("\n");
}

function Mdfind(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query);
  const [scope, setScope] = useState(props.scope ?? "home");
  const [filenameMode, setFilenameMode] = useState<boolean>(props.filenameMode ?? false);
  const limit = Math.max(1, Math.min(500, props.limit ?? 30));
  const [state, setState] = useState<State>({ status: "loading", errorMsg: "", results: [] });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    spotlightSearch({ query, scope, filenameMode, limit })
      .then((r) => {
        if (cancelled) return;
        setState({ status: "done", errorMsg: "", results: r });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
          results: [],
        });
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onSearch() {
    setReloadCount((c) => c + 1);
  }

  function onSetScope(s: string) {
    setScope(s);
    setReloadCount((c) => c + 1);
  }

  function onToggleFilename() {
    setFilenameMode((v) => !v);
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    if (state.results.length === 0) {
      closeWidget(`No Spotlight matches for "${query}".`);
      return;
    }
    const lines = state.results.slice(0, 30).map((r, i) => `${i + 1}. ${r.name} — ${shortPath(r.path)}`);
    closeWidget(`Spotlight "${query}" (scope ${scope}):\n${lines.join("\n")}`);
  }

  return (
    <Form
      header={<CardHeader title="Spotlight" iconBundleId="com.apple.Finder" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Search" onSubmit={onSearch} style="primary" />
          <Action title="Home" onAction={() => onSetScope("home")} style="secondary" />
          <Action title="All" onAction={() => onSetScope("all")} style="secondary" />
          <Action title="Documents" onAction={() => onSetScope(`${process.env.HOME ?? ""}/Documents`)} style="secondary" />
          <Action title="Downloads" onAction={() => onSetScope(`${process.env.HOME ?? ""}/Downloads`)} style="secondary" />
          <Action
            title={filenameMode ? "Full Spotlight" : "Filename only"}
            onAction={onToggleFilename}
            style="secondary"
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(state, query, scope, filenameMode)} />
      <Form.TextField name="query" label="Query" value={query} onChange={setQuery} />
      <Form.TextField name="scope" label="Scope ('home', 'all', or path)" value={scope} onChange={setScope} />
    </Form>
  );
}

const MdfindWidget = defineWidget({
  name: "spotlight_search",
  description:
    "Search the user's files via Spotlight (the macOS-built-in `mdfind` CLI). Plain-text query matches Spotlight's content+metadata index; toggle 'Filename only' for `mdfind -name`. Scope: home (~), all (whole index), or any absolute path. Returns name, parent dir, size, and mtime — file contents are not read or transmitted.",
  schema,
  component: Mdfind,
});

export default MdfindWidget;
