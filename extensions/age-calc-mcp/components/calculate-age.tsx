import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { spanBetween } from "../helpers/age.js";

const schema = z.object({
  fromDate: z.string().optional().describe("Start date (ISO 8601, e.g. '1990-01-15'). Defaults to 30 years ago."),
  toDate: z.string().optional().describe("End date. Defaults to today."),
});

type Props = z.infer<typeof schema>;

function parseProvidedDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function defaultFrom(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
}

function CalculateAge(props: Props) {
  const closeWidget = useCloseWidget();
  const [from, setFrom] = useState<Date | null>(parseProvidedDate(props.fromDate, defaultFrom()));
  const [to, setTo] = useState<Date | null>(parseProvidedDate(props.toDate, new Date()));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const effectiveTo = to ?? now;
  const span = from ? spanBetween(from, effectiveTo) : null;

  function onUseNow() {
    setTo(new Date());
  }

  function onDone() {
    if (!span) closeWidget("No span computed.");
    else closeWidget(`${span.years}y ${span.months}m ${span.days}d (${span.totalDays} days).`);
  }

  const lines: string[] = [];
  if (span) {
    if (span.direction === "same") {
      lines.push("### Same instant");
    } else {
      lines.push(`### ${span.years}y ${span.months}m ${span.days}d`);
      lines.push("");
      lines.push("| | |");
      lines.push("|---|---|");
      lines.push(`| **Total days** | ${span.totalDays.toLocaleString()} |`);
      lines.push(`| **Total hours** | ${span.totalHours.toLocaleString()} |`);
      lines.push(`| **Total minutes** | ${span.totalMinutes.toLocaleString()} |`);
      lines.push(`| **Direction** | ${span.direction === "past" ? "in the past" : "in the future"} |`);
    }
  }

  return (
    <Form
      header={<CardHeader title="Age Calculator" iconBundleId="com.apple.clock" />}
      actions={
        <ActionPanel layout="row">
          <Action title="To = now" onAction={onUseNow} style="secondary" />
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.DatePicker name="fromDate" label="From" value={from ?? defaultFrom()} onChange={setFrom} type="date" />
      <Form.DatePicker name="toDate" label="To" value={to ?? new Date()} onChange={setTo} type="date" />
      {span && <Paper markdown={lines.join("\n")} />}
    </Form>
  );
}

const CalculateAgeWidget = defineWidget({
  name: "calculate-age",
  description:
    "Calculate the age (years/months/days) and total spans (days/hours/minutes) between two dates. Auto-borrows from months when the day-of-month rolls under, so '2026-03-01' minus '2025-12-15' gives 2 months 14 days, not 2 months -14 days.",
  schema,
  component: CalculateAge,
});

export default CalculateAgeWidget;
