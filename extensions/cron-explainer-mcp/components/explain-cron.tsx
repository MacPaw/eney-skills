import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import cronstrue from "cronstrue";

const schema = z.object({
  expression: z.string().optional().describe("Cron expression, e.g. '0 9 * * 1-5'."),
  use24HourTimeFormat: z.boolean().optional().describe("Render times in 24-hour format. Defaults to true."),
  verbose: z.boolean().optional().describe("Verbose explanation. Defaults to false."),
});

type Props = z.infer<typeof schema>;

interface ExplainOk {
  ok: true;
  text: string;
}

interface ExplainErr {
  ok: false;
  error: string;
}

function explain(expression: string, use24h: boolean, verbose: boolean): ExplainOk | ExplainErr | null {
  if (!expression.trim()) return null;
  try {
    const text = cronstrue.toString(expression, { use24HourTimeFormat: use24h, verbose });
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const PRESETS: { label: string; value: string }[] = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Top of every hour", value: "0 * * * *" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Every Monday", value: "0 0 * * 1" },
  { label: "1st of every month", value: "0 0 1 * *" },
];

function ExplainCron(props: Props) {
  const closeWidget = useCloseWidget();
  const [expression, setExpression] = useState(props.expression ?? "");
  const [use24h, setUse24h] = useState(props.use24HourTimeFormat ?? true);
  const [verbose, setVerbose] = useState(props.verbose ?? false);

  const result = useMemo(() => explain(expression, use24h, verbose), [expression, use24h, verbose]);

  function onDone() {
    if (!result) closeWidget("No expression entered.");
    else if (!result.ok) closeWidget(`Invalid: ${result.error}`);
    else closeWidget(result.text);
  }

  const lines: string[] = [];
  if (result?.ok) {
    lines.push(`### \`${expression}\``);
    lines.push("");
    lines.push(result.text);
  } else if (result && !result.ok) {
    lines.push(`**Invalid:** ${result.error}`);
  } else {
    lines.push("Try a cron expression. Common patterns:");
    lines.push("");
    for (const p of PRESETS) lines.push(`- \`${p.value}\` — ${p.label}`);
  }

  return (
    <Form
      header={<CardHeader title="Cron Explainer" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {result?.ok && <Action.CopyToClipboard title="Copy explanation" content={result.text} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="expression" label="Cron expression" value={expression} onChange={setExpression} />
      <Form.Checkbox name="use24h" label="24-hour time" checked={use24h} onChange={setUse24h} variant="switch" />
      <Form.Checkbox name="verbose" label="Verbose" checked={verbose} onChange={setVerbose} variant="switch" />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ExplainCronWidget = defineWidget({
  name: "explain-cron",
  description:
    "Explain a cron expression in plain English using cronstrue. Supports the standard 5-field syntax plus the optional 6-field form with seconds.",
  schema,
  component: ExplainCron,
});

export default ExplainCronWidget;
