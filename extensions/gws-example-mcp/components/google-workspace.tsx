import { exec } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
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

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const GWS_BIN = join(
  __dirname,
  "..",
  "bin",
  process.arch === "arm64" ? "gws-arm64" : "gws-x64"
);

const EXEC_ENV = {
  ...process.env,
  GOOGLE_WORKSPACE_CLI_TOKEN: process.env.GOOGLE_WORKSPACE_CLI_TOKEN ?? "",
};

const schema = z.object({
  calendarId: z
    .string()
    .optional()
    .describe("Calendar ID to fetch events from. Defaults to 'primary'."),
  startDate: z
    .number()
    .optional()
    .describe("Start date as a Unix timestamp. Defaults to today."),
  endDate: z
    .number()
    .optional()
    .describe("End date as a Unix timestamp. Defaults to end of current month."),
});

type Props = z.infer<typeof schema>;

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

async function fetchEvents(calendarId: string, start: Date, end: Date): Promise<string> {
  const params = {
    calendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: 50,
  };

  const { stdout } = await execAsync(
    `"${GWS_BIN}" calendar events list --params '${JSON.stringify(params)}'`,
    { timeout: 15000, env: EXEC_ENV }
  );

  const data = JSON.parse(stdout);
  const items: Array<{
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }> = data.items ?? [];

  if (items.length === 0) {
    return "_No events found for the selected period._";
  }

  const rows = items.map((ev) => {
    const title = ev.summary ?? "(No title)";
    const startStr = ev.start?.dateTime ?? ev.start?.date ?? "";
    const endStr = ev.end?.dateTime ?? ev.end?.date ?? "";
    const startLabel = startStr ? new Date(startStr).toLocaleString() : "—";
    const endLabel = endStr ? new Date(endStr).toLocaleString() : "—";
    return `| ${title} | ${startLabel} | ${endLabel} |`;
  });

  return [
    `**${items.length} event(s) found**\n`,
    "| Event | Start | End |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function GoogleWorkspace(props: Props) {
  const closeWidget = useCloseWidget();
  const today = new Date();

  const token = process.env.GOOGLE_WORKSPACE_CLI_TOKEN ?? "";
  const tokenDisplay = token
    ? `${token.slice(0, 8)}…${token.slice(-4)}`
    : "Not configured";

  const [calendarId, setCalendarId] = useState(props.calendarId ?? "primary");
  const [startDate, setStartDate] = useState<Date>(
    props.startDate ? new Date(props.startDate * 1000) : today
  );
  const [endDate, setEndDate] = useState<Date>(
    props.endDate ? new Date(props.endDate * 1000) : endOfMonth(today)
  );
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onFetch() {
    setIsLoading(true);
    setError("");
    try {
      const markdown = await fetchEvents(calendarId || "primary", startDate, endDate);
      setResult(markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onDone() {
    closeWidget("Done.");
  }

  const header = (
    <CardHeader title="Google Calendar Events" iconBundleId="com.google.GoogleCalendar" />
  );

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Search Again" onSubmit={() => setResult("")} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={result} />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Fetching…" : "Fetch Events"}
            onSubmit={onFetch}
            style="primary"
            isLoading={isLoading}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField
        name="token"
        label="Access Token"
        value={tokenDisplay}
        onChange={() => {}}
      />
      <Form.TextField
        name="calendarId"
        label="Calendar ID"
        value={calendarId}
        onChange={setCalendarId}
      />
      <Form.DatePicker
        name="startDate"
        label="Start Date"
        value={startDate}
        onChange={setStartDate}
        type="date"
      />
      <Form.DatePicker
        name="endDate"
        label="End Date"
        value={endDate}
        onChange={setEndDate}
        type="date"
      />
    </Form>
  );
}

const GoogleWorkspaceWidget = defineWidget({
  name: "google-workspace",
  description: "Getting users events from Google Calendars",
  schema,
  component: GoogleWorkspace,
});

export default GoogleWorkspaceWidget;
