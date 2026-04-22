import { useEffect, useState } from "react";
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
  date: z
    .string()
    .optional()
    .describe("Date in YYYY-MM-DD format. Defaults to today."),
});

type Props = z.infer<typeof schema>;

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function TodayMatches(props: Props) {
  const closeWidget = useCloseWidget();
  const date = props.date ?? todayDate();

  const [isLoading, setIsLoading] = useState(true);
  const [liveMarkdown, setLiveMarkdown] = useState("");
  const [fixturesMarkdown, setFixturesMarkdown] = useState("");
  const [error, setError] = useState("");

  const [matchId, setMatchId] = useState("");
  const [matchDetails, setMatchDetails] = useState("");
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      callTool("get_live_scores").catch((e) => `Error: ${e.message}`),
      callTool("get_day_fixtures", { date }).catch((e) => `Error: ${e.message}`),
    ]).then(([live, fixtures]) => {
      if (cancelled) return;
      setLiveMarkdown(live);
      setFixturesMarkdown(fixtures);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [date]);

  async function onViewMatch() {
    if (!matchId.trim()) return;
    setIsLoadingMatch(true);
    setMatchError("");
    setMatchDetails("");
    try {
      const details = await callTool("get_match", { match_id: matchId.trim() });
      setMatchDetails(details);
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingMatch(false);
    }
  }

  async function onRefresh() {
    setIsLoading(true);
    setError("");
    try {
      const [live, fixtures] = await Promise.all([
        callTool("get_live_scores"),
        callTool("get_day_fixtures", { date }),
      ]);
      setLiveMarkdown(live);
      setFixturesMarkdown(fixtures);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  if (matchDetails) {
    return (
      <Form
        header={<CardHeader title="Match Details" iconBundleId="com.apple.reminders" />}
        actions={
          <ActionPanel layout="row">
            <Action
              title="Back to Today"
              onAction={() => {
                setMatchDetails("");
                setMatchId("");
              }}
              style="secondary"
            />
            <Action title="Done" onAction={() => closeWidget("Done.")} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={matchDetails} isScrollable />
      </Form>
    );
  }

  return (
    <Form
      header={<CardHeader title={`Football — ${date}`} iconBundleId="com.apple.reminders" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title={isLoadingMatch ? "Loading..." : "View Match"}
            onAction={onViewMatch}
            style="secondary"
            isLoading={isLoadingMatch}
            isDisabled={!matchId.trim() || isLoading}
          />
          <Action
            title={isLoading ? "Loading..." : "Refresh"}
            onAction={onRefresh}
            style="secondary"
            isLoading={isLoading}
          />
          <Action title="Done" onAction={() => closeWidget("Done.")} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {isLoading ? (
        <Paper markdown="_Loading matches..._" />
      ) : (
        <>
          <Paper markdown={`## Live Matches\n\n${liveMarkdown || "_No live matches right now._"}`} isScrollable />
          <Paper markdown={`## All Fixtures — ${date}\n\n${fixturesMarkdown || "_No fixtures found._"}`} isScrollable />
        </>
      )}
      {matchError && <Paper markdown={`**Match error:** ${matchError}`} />}
      <Form.TextField
        name="matchId"
        label="Match ID (enter to view details)"
        value={matchId}
        onChange={setMatchId}
      />
    </Form>
  );
}

const TodayMatchesWidget = defineWidget({
  name: "today-matches",
  description:
    "Show today's live and upcoming football matches. Optionally view detailed info for a specific match by ID.",
  schema,
  component: TodayMatches,
});

export default TodayMatchesWidget;
