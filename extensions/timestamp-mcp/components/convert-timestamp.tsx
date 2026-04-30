import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  input: z.string().optional().describe("Either a Unix timestamp (seconds or milliseconds) or a parseable date string."),
});

type Props = z.infer<typeof schema>;

interface Conversion {
  date: Date;
  inputWasMs: boolean;
}

function parseInput(raw: string): Conversion | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return null;
    const inputWasMs = Math.abs(n) >= 1e12;
    const ms = inputWasMs ? n : n * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : { date, inputWasMs };
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : { date, inputWasMs: false };
}

function formatRelative(then: Date, now: Date): string {
  const diffMs = then.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const future = diffMs > 0;
  const seconds = Math.round(abs / 1000);
  if (seconds < 60) return future ? `in ${seconds}s` : `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return future ? `in ${days} days` : `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return future ? `in ${months} months` : `${months} months ago`;
  const years = (days / 365.25).toFixed(1);
  return future ? `in ${years} years` : `${years} years ago`;
}

function ConvertTimestamp(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const conversion = parseInput(input);

  function onUseNow() {
    setInput(String(Math.floor(Date.now() / 1000)));
  }

  function onDone() {
    if (!conversion) closeWidget("No timestamp parsed.");
    else closeWidget(conversion.date.toISOString());
  }

  const lines: string[] = [];
  if (conversion) {
    const ms = conversion.date.getTime();
    const seconds = Math.floor(ms / 1000);
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| **Unix (seconds)** | \`${seconds}\` |`);
    lines.push(`| **Unix (milliseconds)** | \`${ms}\` |`);
    lines.push(`| **ISO 8601 (UTC)** | \`${conversion.date.toISOString()}\` |`);
    lines.push(`| **Local** | \`${conversion.date.toString()}\` |`);
    lines.push(`| **Relative** | ${formatRelative(conversion.date, now)} |`);
  } else if (input.trim()) {
    lines.push("_Could not parse input._");
    lines.push("");
    lines.push("Try a Unix timestamp (`1735689600`), a millisecond timestamp (`1735689600000`), or an ISO date (`2026-01-01T00:00:00Z`).");
  } else {
    lines.push("Enter a timestamp or date above.");
  }

  return (
    <Form
      header={<CardHeader title="Timestamp" iconBundleId="com.apple.clock" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Use now" onAction={onUseNow} style="secondary" />
          {conversion && (
            <Action.CopyToClipboard
              title="Copy ISO"
              content={conversion.date.toISOString()}
            />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="Timestamp or date" value={input} onChange={setInput} />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ConvertTimestampWidget = defineWidget({
  name: "convert-timestamp",
  description:
    "Convert between Unix timestamps (seconds or milliseconds) and ISO 8601 dates. Auto-detects input format and shows seconds, milliseconds, ISO UTC, local, and relative time.",
  schema,
  component: ConvertTimestamp,
});

export default ConvertTimestampWidget;
