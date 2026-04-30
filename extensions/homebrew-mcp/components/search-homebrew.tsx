import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { runBrew } from "../helpers/run-brew.js";

const schema = z.object({
  query: z.string().optional().describe("The package name (or fragment) to search for."),
});

type Props = z.infer<typeof schema>;

interface SearchResult {
  formulae: string[];
  casks: string[];
}

function parseSearchOutput(output: string): SearchResult {
  const formulae: string[] = [];
  const casks: string[] = [];
  let bucket: "formulae" | "casks" | null = null;
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("==>")) {
      if (line.toLowerCase().includes("cask")) bucket = "casks";
      else if (line.toLowerCase().includes("formula")) bucket = "formulae";
      else bucket = null;
      continue;
    }
    if (bucket === "formulae") formulae.push(line);
    else if (bucket === "casks") casks.push(line);
  }
  return { formulae, casks };
}

function SearchHomebrew(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query ?? "");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!query.trim()) return;
    setIsSearching(true);
    setError("");
    try {
      const output = await runBrew(["search", query.trim()]);
      setResult(parseSearchOutput(output));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSearching(false);
    }
  }

  function onDone() {
    if (!result) {
      closeWidget("Search cancelled.");
      return;
    }
    const total = result.formulae.length + result.casks.length;
    closeWidget(`Found ${total} match(es) for "${query}".`);
  }

  if (result) {
    const lines: string[] = [];
    if (result.formulae.length) {
      lines.push(`### Formulae (${result.formulae.length})`);
      lines.push(...result.formulae.map((name) => `- \`${name}\``));
    }
    if (result.casks.length) {
      if (lines.length) lines.push("");
      lines.push(`### Casks (${result.casks.length})`);
      lines.push(...result.casks.map((name) => `- \`${name}\``));
    }
    if (!lines.length) lines.push(`No matches found for **${query}**.`);

    return (
      <Form
        header={<CardHeader title="Search Homebrew" iconBundleId="com.apple.Terminal" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="New Search" onSubmit={() => setResult(null)} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={lines.join("\n")} />
        <Form.TextField name="query" label="Query" value={query} onChange={setQuery} isCopyable />
      </Form>
    );
  }

  return (
    <Form
      header={<CardHeader title="Search Homebrew" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSearching ? "Searching..." : "Search"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSearching}
            isDisabled={!query.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="query" label="Query" value={query} onChange={setQuery} />
    </Form>
  );
}

const SearchHomebrewWidget = defineWidget({
  name: "search-homebrew",
  description: "Search Homebrew formulae and casks by name.",
  schema,
  component: SearchHomebrew,
});

export default SearchHomebrewWidget;
