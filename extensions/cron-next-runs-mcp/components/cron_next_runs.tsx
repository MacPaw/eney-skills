import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { nextRuns, type NextRunsResult } from "../helpers/cron.js";

const schema = z.object({
  expression: z.string().describe("Cron expression, e.g. '0 9 * * 1-5' (weekdays at 9am)."),
  count: z
    .number()
    .int()
    .optional()
    .describe("How many upcoming firings to show. Defaults to 10. Max 50."),
  timezone: z
    .string()
    .optional()
    .describe("IANA timezone, e.g. 'America/New_York', 'Europe/Berlin'. Defaults to UTC."),
});

type Props = z.infer<typeof schema>;

interface State {
  result: NextRunsResult | null;
  error: string;
}

const PRESETS: { label: string; expr: string; note: string }[] = [
  { label: "Every minute", expr: "* * * * *", note: "every minute" },
  { label: "Hourly", expr: "0 * * * *", note: "top of every hour" },
  { label: "Daily 9am", expr: "0 9 * * *", note: "every day at 9:00" },
  { label: "Weekdays 9am", expr: "0 9 * * 1-5", note: "Mon–Fri at 9:00" },
  { label: "Sunday midnight", expr: "0 0 * * 0", note: "every Sunday at 00:00" },
];

function safeNext(expr: string, count: number, tz?: string): State {
  try {
    return { result: nextRuns(expr, count, tz), error: "" };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function CronNextRuns(props: Props) {
  const closeWidget = useCloseWidget();
  const [expression, setExpression] = useState(props.expression);
  const [count, setCount] = useState<number>(props.count ?? 10);
  const [timezone, setTimezone] = useState(props.timezone ?? "");
  const [state, setState] = useState<State>(() =>
    safeNext(props.expression, props.count ?? 10, props.timezone),
  );

  function recompute(opts?: Partial<{ e: string; c: number; tz: string }>) {
    const e = opts?.e ?? expression;
    const c = opts?.c ?? count;
    const tz = (opts?.tz ?? timezone).trim();
    setState(safeNext(e, c, tz || undefined));
  }

  function onCompute() {
    recompute();
  }

  function onPreset(expr: string) {
    setExpression(expr);
    recompute({ e: expr });
  }

  function onSetTimezone(tz: string) {
    setTimezone(tz);
    recompute({ tz });
  }

  function onDone() {
    if (state.error) {
      closeWidget(`Error: ${state.error}`);
      return;
    }
    if (!state.result) {
      closeWidget("Closed.");
      return;
    }
    const lines = state.result.runs.map((r, i) => `${i + 1}. ${r.display}`);
    closeWidget(
      `Cron \`${state.result.expression}\` (${state.result.timezone}) — next ${state.result.count} runs:\n${lines.join("\n")}`,
    );
  }

  let markdown: string;
  if (state.error) {
    markdown = `**Error:** ${state.error}`;
  } else if (state.result) {
    const r = state.result;
    const lines = [
      `### \`${r.expression}\``,
      `_Timezone: **${r.timezone}** · Next ${r.count} run${r.count === 1 ? "" : "s"}_`,
      "",
    ];
    r.runs.forEach((run, i) => {
      lines.push(`${i + 1}. ${run.display}`);
    });
    markdown = lines.join("\n");
  } else {
    markdown = "_Enter a cron expression and tap Compute._";
  }

  return (
    <Form
      header={<CardHeader title="Cron Next Runs" iconBundleId="com.apple.iCal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Compute" onSubmit={onCompute} style="primary" />
          {PRESETS.map((p) => (
            <Action key={p.label} title={p.label} onAction={() => onPreset(p.expr)} style="secondary" />
          ))}
          <Action title="UTC" onAction={() => onSetTimezone("")} style="secondary" />
          <Action title="NYC" onAction={() => onSetTimezone("America/New_York")} style="secondary" />
          <Action title="London" onAction={() => onSetTimezone("Europe/London")} style="secondary" />
          <Action title="Tokyo" onAction={() => onSetTimezone("Asia/Tokyo")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="expression"
        label="Cron expression"
        value={expression}
        onChange={setExpression}
      />
      <Form.NumberField
        name="count"
        label="How many upcoming runs"
        value={count}
        onChange={(v) => setCount(Math.max(1, Math.min(50, Math.floor(Number(v) || 10))))}
      />
      <Form.TextField
        name="timezone"
        label="IANA timezone (empty = UTC)"
        value={timezone}
        onChange={setTimezone}
      />
    </Form>
  );
}

const CronNextRunsWidget = defineWidget({
  name: "cron_next_runs",
  description:
    "Preview the next N firings of a cron expression in a chosen IANA timezone. Distinct from cron-explainer (which translates the expression to English) — this one shows the actual upcoming schedule. Validates the expression and surfaces parse errors cleanly. Built on cron-parser.",
  schema,
  component: CronNextRuns,
});

export default CronNextRunsWidget;
