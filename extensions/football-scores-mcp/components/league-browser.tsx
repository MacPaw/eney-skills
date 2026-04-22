import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import { callTool } from "../helpers/livescore-client.js";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("Team, player, or competition name to search for."),
});

type Props = z.infer<typeof schema>;

type View = "search" | "results" | "match";

function LeagueBrowser(props: Props) {
  const closeWidget = useCloseWidget();

  const [query, setQuery] = useState(props.query ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState("");
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState("");
  const [entityType, setEntityType] = useState<"league" | "match">("league");
  const [detailsMarkdown, setDetailsMarkdown] = useState("");
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [view, setView] = useState<View>("search");

  async function onSearch() {
    if (!query.trim()) return;
    setIsLoading(true);
    setError("");
    setSearchResults("");
    try {
      const results = await callTool("search", { query: query.trim() });
      setSearchResults(results);
      setView("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onGetDetails() {
    if (!selectedId.trim()) return;
    setIsLoadingDetails(true);
    setError("");
    setDetailsMarkdown("");
    try {
      const toolName = entityType === "league" ? "get_league_fixtures" : "get_match";
      const argKey = entityType === "league" ? "league_id" : "match_id";
      const details = await callTool(toolName, { [argKey]: selectedId.trim() });
      setDetailsMarkdown(details);
      setView("match");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingDetails(false);
    }
  }

  if (view === "match" && detailsMarkdown) {
    const title = entityType === "league" ? "League Fixtures" : "Match Details";
    return (
      <Form
        header={<CardHeader title={title} iconBundleId="com.apple.reminders" />}
        actions={
          <ActionPanel layout="row">
            <Action
              title="Back to Search"
              onAction={() => {
                setView("search");
                setDetailsMarkdown("");
                setSelectedId("");
              }}
              style="secondary"
            />
            <Action title="Done" onAction={() => closeWidget("Done.")} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={detailsMarkdown} isScrollable />
      </Form>
    );
  }

  if (view === "results" && searchResults) {
    return (
      <Form
        header={<CardHeader title="Search Results" iconBundleId="com.apple.reminders" />}
        actions={
          <ActionPanel layout="row">
            <Action
              title="Back"
              onAction={() => {
                setView("search");
                setSearchResults("");
              }}
              style="secondary"
            />
            <Action
              title={isLoadingDetails ? "Loading..." : "Get Details"}
              onAction={onGetDetails}
              style="primary"
              isLoading={isLoadingDetails}
              isDisabled={!selectedId.trim()}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Paper markdown={searchResults} isScrollable />
        <Form.TextField
          name="selectedId"
          label="Enter ID from results above"
          value={selectedId}
          onChange={setSelectedId}
        />
        <Form.Dropdown name="entityType" label="Type" value={entityType} onChange={(v) => setEntityType(v as "league" | "match")}>
          <Form.Dropdown.Item value="league" title="League / Competition Fixtures" />
          <Form.Dropdown.Item value="match" title="Match Details" />
        </Form.Dropdown>
      </Form>
    );
  }

  return (
    <Form
      header={<CardHeader title="Football Search" iconBundleId="com.apple.reminders" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isLoading ? "Searching..." : "Search"}
            onSubmit={onSearch}
            style="primary"
            isLoading={isLoading}
            isDisabled={!query.trim()}
          />
          <Action title="Done" onAction={() => closeWidget("Done.")} style="secondary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={"Search for a team, player, or competition to browse fixtures and match details."} />
      <Form.TextField
        name="query"
        label="Search"
        value={query}
        onChange={setQuery}
      />
    </Form>
  );
}

const LeagueBrowserWidget = defineWidget({
  name: "league-browser",
  description:
    "Search for football teams, players, or competitions to browse league fixtures and detailed match information.",
  schema,
  component: LeagueBrowser,
});

export default LeagueBrowserWidget;
