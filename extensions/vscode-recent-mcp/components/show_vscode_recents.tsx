import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { readRecents, openInVsCode, type RecentEntry } from "../helpers/vscode.js";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional substring to filter by path or label."),
  kind: z
    .enum(["all", "workspace", "folder", "file"])
    .optional()
    .describe("Filter by entry kind. Defaults to 'all'."),
});

type Props = z.infer<typeof schema>;

const KIND_EMOJI: Record<string, string> = {
  workspace: "🧩",
  folder: "📁",
  file: "📄",
};

interface State {
  status: "loading" | "done" | "error";
  errorMsg: string;
  entries: RecentEntry[];
  flash: string;
}

function shortPath(p: string): string {
  const home = process.env.HOME ?? "";
  if (home && p.startsWith(home)) return p.replace(home, "~");
  return p;
}

function filter(entries: RecentEntry[], query: string, kind: string): RecentEntry[] {
  let out = entries;
  if (kind !== "all") out = out.filter((e) => e.kind === kind);
  const q = query.trim().toLowerCase();
  if (!q) return out;
  return out.filter(
    (e) => e.label.toLowerCase().includes(q) || e.path.toLowerCase().includes(q),
  );
}

function buildMarkdown(state: State, query: string, kind: string): string {
  if (state.status === "loading") return "_Loading recents…_";
  if (state.status === "error") return `**Error:** ${state.errorMsg}`;
  const matches = filter(state.entries, query, kind);
  const lines: string[] = [];
  lines.push(
    `### Recents — ${matches.length} of ${state.entries.length}${query.trim() ? ` matching "${query}"` : ""}`,
  );
  if (state.flash) {
    lines.push("");
    lines.push(`> ${state.flash}`);
  }
  lines.push("");
  if (matches.length === 0) {
    lines.push("_No matching entries._");
    return lines.join("\n");
  }
  matches.slice(0, 60).forEach((e, i) => {
    lines.push(`${i + 1}. ${KIND_EMOJI[e.kind] ?? "•"} **${e.label}**`);
    lines.push(`   \`${shortPath(e.path)}\``);
  });
  if (matches.length > 60) lines.push(`\n_…and ${matches.length - 60} more_`);
  return lines.join("\n");
}

function VsCodeRecents(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query ?? "");
  const [kind, setKind] = useState<NonNullable<Props["kind"]>>(props.kind ?? "all");
  const [state, setState] = useState<State>({ status: "loading", errorMsg: "", entries: [], flash: "" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading", flash: "" }));
    readRecents()
      .then((entries) => {
        if (cancelled) return;
        setState({ status: "done", errorMsg: "", entries, flash: "" });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
          entries: [],
          flash: "",
        });
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onRefresh() {
    setReloadCount((c) => c + 1);
  }

  function onSetKind(k: NonNullable<Props["kind"]>) {
    setKind(k);
  }

  async function onOpenFirst() {
    const matches = filter(state.entries, query, kind);
    if (matches.length === 0) {
      setState((s) => ({ ...s, flash: "⚠️ No matching entries to open." }));
      return;
    }
    const first = matches[0];
    try {
      await openInVsCode(first.path);
      setState((s) => ({ ...s, flash: `✅ Opened ${first.label}` }));
    } catch (err) {
      setState((s) => ({
        ...s,
        flash: `❌ ${err instanceof Error ? err.message : String(err)}`,
      }));
    }
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    const matches = filter(state.entries, query, kind).slice(0, 30);
    if (matches.length === 0) {
      closeWidget("No matching VS Code recents.");
      return;
    }
    closeWidget(
      `${matches.length} recent VS Code entr${matches.length === 1 ? "y" : "ies"}:\n` +
      matches.map((e) => `- [${e.kind}] ${e.label} — ${e.path}`).join("\n"),
    );
  }

  return (
    <Form
      header={<CardHeader title="VS Code Recents" iconBundleId="com.microsoft.VSCode" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={onRefresh} style="primary" />
          <Action title="All" onAction={() => onSetKind("all")} style="secondary" />
          <Action title="Workspaces" onAction={() => onSetKind("workspace")} style="secondary" />
          <Action title="Folders" onAction={() => onSetKind("folder")} style="secondary" />
          <Action title="Files" onAction={() => onSetKind("file")} style="secondary" />
          <Action title="Open first match" onAction={onOpenFirst} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(state, query, kind)} />
      <Form.TextField name="query" label="Filter (path/label substring)" value={query} onChange={setQuery} />
    </Form>
  );
}

const VsCodeRecentsWidget = defineWidget({
  name: "show_vscode_recents",
  description:
    "List Visual Studio Code's recently opened workspaces, folders, and files (read from VS Code's local state.vscdb via /usr/bin/sqlite3) and reopen one with the `code` CLI or `open -a 'Visual Studio Code'`.",
  schema,
  component: VsCodeRecents,
});

export default VsCodeRecentsWidget;
