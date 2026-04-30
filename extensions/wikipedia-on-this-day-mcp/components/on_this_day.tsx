import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  date: z
    .string()
    .optional()
    .describe("Date as MM-DD or YYYY-MM-DD. Defaults to today."),
  type: z
    .enum(["events", "births", "deaths", "holidays", "selected", "all"])
    .optional()
    .describe("Type of entries. Defaults to 'events'."),
  limit: z
    .number()
    .int()
    .optional()
    .describe("Maximum entries to display. Defaults to 10."),
});

type Props = z.infer<typeof schema>;

const USER_AGENT = "eney-skills-mcp/1.0 (https://github.com/MacPaw/eney-skills)";

interface Page {
  title: string;
  contentUrl: string;
}

interface Entry {
  year?: number;
  text: string;
  pages: Page[];
}

interface FeedResponse {
  events?: RawEntry[];
  births?: RawEntry[];
  deaths?: RawEntry[];
  holidays?: RawEntry[];
  selected?: RawEntry[];
}

interface RawEntry {
  year?: number;
  text: string;
  pages?: Array<{
    title?: string;
    titles?: { normalized?: string };
    content_urls?: { desktop?: { page?: string } };
  }>;
}

function parseMonthDay(input: string | undefined): { month: string; day: string; pretty: string } {
  const today = new Date();
  if (!input) {
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d = String(today.getUTCDate()).padStart(2, "0");
    return { month: m, day: d, pretty: `${m}-${d}` };
  }
  const cleaned = input.trim();
  let mm = "";
  let dd = "";
  const fullMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  const partMatch = /^(\d{2})-(\d{2})$/.exec(cleaned);
  if (fullMatch) {
    mm = fullMatch[2];
    dd = fullMatch[3];
  } else if (partMatch) {
    mm = partMatch[1];
    dd = partMatch[2];
  } else {
    throw new Error(`Invalid date format: "${cleaned}". Use MM-DD or YYYY-MM-DD.`);
  }
  const monthNum = +mm;
  const dayNum = +dd;
  if (monthNum < 1 || monthNum > 12) throw new Error("Month must be 01–12.");
  if (dayNum < 1 || dayNum > 31) throw new Error("Day must be 01–31.");
  return { month: mm, day: dd, pretty: `${mm}-${dd}` };
}

async function fetchEntries(
  type: "events" | "births" | "deaths" | "holidays" | "selected" | "all",
  month: string,
  day: string,
): Promise<Record<string, Entry[]>> {
  const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/${type}/${month}/${day}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia API error ${res.status}`);
  const data = await res.json() as FeedResponse;

  const sections: Record<string, Entry[]> = {};
  for (const key of ["selected", "events", "births", "deaths", "holidays"] as const) {
    const arr = data[key];
    if (!Array.isArray(arr)) continue;
    sections[key] = arr.map((e) => ({
      year: e.year,
      text: e.text,
      pages: (e.pages ?? []).slice(0, 3).map((p) => ({
        title: p.title ?? p.titles?.normalized ?? "Wikipedia",
        contentUrl: p.content_urls?.desktop?.page ?? "",
      })),
    }));
  }
  return sections;
}

function buildMarkdown(
  sections: Record<string, Entry[]>,
  type: string,
  pretty: string,
  limit: number,
): string {
  const lines: string[] = [];
  lines.push(`### 📅 On ${pretty}`);
  lines.push("");
  const sectionOrder =
    type === "all"
      ? ["selected", "events", "births", "deaths", "holidays"]
      : [type];
  let total = 0;
  for (const sec of sectionOrder) {
    const entries = sections[sec];
    if (!entries || entries.length === 0) continue;
    lines.push(`#### ${sec[0].toUpperCase() + sec.slice(1)}`);
    for (const e of entries.slice(0, limit)) {
      const yearStr = e.year !== undefined ? `**${e.year}** — ` : "";
      lines.push(`- ${yearStr}${e.text}`);
      total++;
    }
    lines.push("");
  }
  if (total === 0) lines.push("_No entries returned._");
  return lines.join("\n");
}

function OnThisDay(props: Props) {
  const closeWidget = useCloseWidget();
  const [dateInput, setDateInput] = useState(props.date ?? "");
  const [type, setType] = useState<NonNullable<Props["type"]>>(props.type ?? "events");
  const limit = Math.max(1, Math.min(50, props.limit ?? 10));

  const [pretty, setPretty] = useState<string>("");
  const [sections, setSections] = useState<Record<string, Entry[]>>({});
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    try {
      const { month, day, pretty: p } = parseMonthDay(dateInput || undefined);
      setPretty(p);
      fetchEntries(type, month, day)
        .then((s) => {
          if (cancelled) return;
          setSections(s);
          setStatus("done");
        })
        .catch((err) => {
          if (cancelled) return;
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus("error");
        });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onSetType(t: NonNullable<Props["type"]>) {
    setType(t);
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (status === "error") {
      closeWidget(`Error: ${errorMsg}`);
      return;
    }
    const flat: string[] = [];
    flat.push(`On ${pretty}:`);
    for (const sec of Object.keys(sections)) {
      const entries = sections[sec];
      if (!entries || entries.length === 0) continue;
      flat.push(`\n${sec}:`);
      for (const e of entries.slice(0, limit)) {
        flat.push(`- ${e.year ? `${e.year} — ` : ""}${e.text}`);
      }
    }
    closeWidget(flat.join("\n"));
  }

  const markdown =
    status === "loading"
      ? "_Loading…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : buildMarkdown(sections, type, pretty, limit);

  return (
    <Form
      header={<CardHeader title="On This Day" iconBundleId="com.apple.iCal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Events" onAction={() => onSetType("events")} style="secondary" />
          <Action title="Births" onAction={() => onSetType("births")} style="secondary" />
          <Action title="Deaths" onAction={() => onSetType("deaths")} style="secondary" />
          <Action title="Holidays" onAction={() => onSetType("holidays")} style="secondary" />
          <Action title="All" onAction={() => onSetType("all")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="date"
        label="Date (MM-DD or YYYY-MM-DD; empty = today)"
        value={dateInput}
        onChange={setDateInput}
      />
    </Form>
  );
}

const OnThisDayWidget = defineWidget({
  name: "on_this_day",
  description:
    "Historical events, births, deaths, and holidays that happened on a given calendar day, sourced from Wikipedia's On This Day API. Defaults to today.",
  schema,
  component: OnThisDay,
});

export default OnThisDayWidget;
