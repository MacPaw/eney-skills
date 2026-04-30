import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  birthday: z
    .string()
    .describe("Birthday as YYYY-MM-DD (full date) or MM-DD (just month/day)."),
  name: z
    .string()
    .optional()
    .describe("Optional name to personalise the message."),
});

type Props = z.infer<typeof schema>;

interface ParsedBirthday {
  month: number; // 1..12
  day: number;   // 1..31
  year: number | null; // null if MM-DD only
}

function parseBirthday(input: string): ParsedBirthday {
  const trimmed = input.trim();
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (full) {
    const y = +full[1];
    const m = +full[2];
    const d = +full[3];
    if (m < 1 || m > 12) throw new Error("Month must be 01–12.");
    if (d < 1 || d > 31) throw new Error("Day must be 01–31.");
    return { year: y, month: m, day: d };
  }
  const md = /^(\d{2})-(\d{2})$/.exec(trimmed);
  if (md) {
    const m = +md[1];
    const d = +md[2];
    if (m < 1 || m > 12) throw new Error("Month must be 01–12.");
    if (d < 1 || d > 31) throw new Error("Day must be 01–31.");
    return { year: null, month: m, day: d };
  }
  throw new Error("Use YYYY-MM-DD or MM-DD format.");
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

interface Countdown {
  daysUntil: number; // 0 == today
  nextBirthday: Date;
  age: number | null; // age the person turns on the next birthday (or current age if today)
  currentAge: number | null;
  weekday: string;
}

function calculate(parsed: ParsedBirthday, now: Date = new Date()): Countdown {
  const today = startOfDayUTC(now);
  const thisYear = today.getUTCFullYear();
  let next = new Date(Date.UTC(thisYear, parsed.month - 1, parsed.day));
  if (next.getTime() < today.getTime()) {
    next = new Date(Date.UTC(thisYear + 1, parsed.month - 1, parsed.day));
  }
  const ms = next.getTime() - today.getTime();
  const daysUntil = Math.round(ms / 86_400_000);
  const weekday = next.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  let age: number | null = null;
  let currentAge: number | null = null;
  if (parsed.year !== null) {
    const turning = next.getUTCFullYear() - parsed.year;
    age = turning;
    currentAge = daysUntil === 0 ? turning : turning - 1;
  }
  return { daysUntil, nextBirthday: next, age, currentAge, weekday };
}

function buildMarkdown(parsed: ParsedBirthday, c: Countdown, name: string): string {
  const dateStr = c.nextBirthday.toISOString().slice(0, 10);
  const who = name.trim() ? `**${name}**'s` : "Your";
  const lines: string[] = [];
  if (c.daysUntil === 0) {
    lines.push(`### 🎉 Happy birthday${name.trim() ? `, ${name}` : ""}!`);
    if (c.age !== null) {
      lines.push("");
      lines.push(`Turning **${c.age}** today.`);
    }
  } else if (c.daysUntil === 1) {
    lines.push(`### 🎂 ${who} birthday is **tomorrow**!`);
  } else {
    lines.push(`### 🎂 ${c.daysUntil} days until ${who} birthday`);
  }
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Next birthday | **${dateStr}** (${c.weekday}) |`);
  if (c.currentAge !== null && c.daysUntil !== 0) {
    lines.push(`| Current age | ${c.currentAge} |`);
    lines.push(`| Will turn | **${c.age}** |`);
  } else if (c.currentAge !== null && c.daysUntil === 0) {
    lines.push(`| Now | **${c.age}** years old |`);
  } else {
    lines.push(`| Birthday | ${parsed.month.toString().padStart(2, "0")}-${parsed.day.toString().padStart(2, "0")} (year not given) |`);
  }
  return lines.join("\n");
}

interface State {
  countdown: Countdown | null;
  parsed: ParsedBirthday | null;
  error: string;
}

function safeAnalyze(input: string): State {
  try {
    const parsed = parseBirthday(input);
    return { parsed, countdown: calculate(parsed), error: "" };
  } catch (err) {
    return { parsed: null, countdown: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function BirthdayCountdown(props: Props) {
  const closeWidget = useCloseWidget();
  const [birthday, setBirthday] = useState(props.birthday);
  const [name, setName] = useState(props.name ?? "");
  const [state, setState] = useState<State>(() => safeAnalyze(props.birthday));

  function onCheck() {
    setState(safeAnalyze(birthday));
  }

  function onDone() {
    if (state.error || !state.countdown) {
      closeWidget(state.error ? `Error: ${state.error}` : "Closed.");
      return;
    }
    const c = state.countdown;
    const ageNote = c.currentAge !== null ? `, current age ${c.currentAge}, turns ${c.age}` : "";
    closeWidget(
      `${name.trim() ? name + "'s" : "Your"} next birthday: ` +
      `${c.nextBirthday.toISOString().slice(0, 10)} (${c.weekday}) — ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"} away${ageNote}.`,
    );
  }

  const markdown = state.error
    ? `**Error:** ${state.error}`
    : state.countdown && state.parsed
      ? buildMarkdown(state.parsed, state.countdown, name)
      : "_Enter a birthday._";

  return (
    <Form
      header={<CardHeader title="Birthday Countdown 🎂" iconBundleId="com.apple.iCal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Calculate" onSubmit={onCheck} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="birthday"
        label="Birthday (YYYY-MM-DD or MM-DD)"
        value={birthday}
        onChange={setBirthday}
      />
      <Form.TextField
        name="name"
        label="Name (optional)"
        value={name}
        onChange={setName}
      />
    </Form>
  );
}

const BirthdayCountdownWidget = defineWidget({
  name: "birthday_countdown",
  description:
    "Show the days until the next birthday and the age the person will turn. Accepts YYYY-MM-DD or MM-DD; without a year only the days-until is computed. Pure local math, no network.",
  schema,
  component: BirthdayCountdown,
});

export default BirthdayCountdownWidget;
