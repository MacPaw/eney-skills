import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  date: z
    .string()
    .optional()
    .describe("Date in YYYY-MM-DD format. Defaults to today."),
});

type Props = z.infer<typeof schema>;

interface MoonInfo {
  age: number; // days since last new moon (0–29.53)
  illumination: number; // 0..1
  phaseName: string;
  emoji: string;
  trend: "waxing" | "waning" | "stable";
  daysUntilNextNew: number;
  daysUntilNextFull: number;
  date: string;
}

const SYNODIC_MONTH = 29.53058867;
// Reference new moon: 2000-01-06 18:14 UTC (Julian Date 2451550.1)
const REFERENCE_NEW_MOON_JD = 2451550.1;

function toJulianDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

function moonAge(date: Date): number {
  const jd = toJulianDate(date);
  let age = ((jd - REFERENCE_NEW_MOON_JD) % SYNODIC_MONTH);
  if (age < 0) age += SYNODIC_MONTH;
  return age;
}

function classify(age: number): { phaseName: string; emoji: string } {
  // 8-phase classification
  // Phase boundaries split the synodic month into 8 segments around the
  // 4 cardinal phases (new, first quarter, full, last quarter).
  const cycle = age / SYNODIC_MONTH; // 0..1
  if (cycle < 0.0181 || cycle >= 0.9819) return { phaseName: "New moon", emoji: "🌑" };
  if (cycle < 0.2319) return { phaseName: "Waxing crescent", emoji: "🌒" };
  if (cycle < 0.2681) return { phaseName: "First quarter", emoji: "🌓" };
  if (cycle < 0.4819) return { phaseName: "Waxing gibbous", emoji: "🌔" };
  if (cycle < 0.5181) return { phaseName: "Full moon", emoji: "🌕" };
  if (cycle < 0.7319) return { phaseName: "Waning gibbous", emoji: "🌖" };
  if (cycle < 0.7681) return { phaseName: "Last quarter", emoji: "🌗" };
  return { phaseName: "Waning crescent", emoji: "🌘" };
}

function illuminationFraction(age: number): number {
  // Phase angle from age in radians
  const phaseAngle = (2 * Math.PI * age) / SYNODIC_MONTH;
  return (1 - Math.cos(phaseAngle)) / 2;
}

function computeMoonInfo(date: Date): MoonInfo {
  const age = moonAge(date);
  const { phaseName, emoji } = classify(age);
  const illumination = illuminationFraction(age);
  const cycle = age / SYNODIC_MONTH;
  const trend: MoonInfo["trend"] =
    cycle < 0.5 ? "waxing" : cycle > 0.5 ? "waning" : "stable";
  const daysUntilNextNew = SYNODIC_MONTH - age;
  const halfCycle = SYNODIC_MONTH / 2;
  const daysUntilNextFull =
    age < halfCycle ? halfCycle - age : SYNODIC_MONTH + halfCycle - age;
  return {
    age,
    illumination,
    phaseName,
    emoji,
    trend,
    daysUntilNextNew,
    daysUntilNextFull,
    date: date.toISOString().slice(0, 10),
  };
}

function buildMarkdown(info: MoonInfo): string {
  const pct = (info.illumination * 100).toFixed(1);
  const ageDays = info.age.toFixed(2);
  return [
    `### ${info.emoji} **${info.phaseName}**`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Illumination | **${pct}%** |`,
    `| Lunar age | ${ageDays} days |`,
    `| Trend | ${info.trend} |`,
    `| Next new moon | ~${info.daysUntilNextNew.toFixed(1)} days |`,
    `| Next full moon | ~${info.daysUntilNextFull.toFixed(1)} days |`,
    ``,
    `_Date: ${info.date}_`,
  ].join("\n");
}

function parseDateOrToday(input?: string): Date {
  if (!input) return new Date();
  const trimmed = input.trim();
  // Anchor to noon UTC to avoid TZ drift when only a date is supplied.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function MoonPhase(props: Props) {
  const closeWidget = useCloseWidget();
  const [date, setDate] = useState(props.date ?? new Date().toISOString().slice(0, 10));
  const [info, setInfo] = useState<MoonInfo>(() => computeMoonInfo(parseDateOrToday(props.date)));
  const [errorMsg, setErrorMsg] = useState("");

  function onCompute() {
    try {
      const d = parseDateOrToday(date);
      if (Number.isNaN(d.getTime())) throw new Error("Invalid date format. Use YYYY-MM-DD.");
      setInfo(computeMoonInfo(d));
      setErrorMsg("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function onToday() {
    const today = new Date().toISOString().slice(0, 10);
    setDate(today);
    setInfo(computeMoonInfo(new Date()));
    setErrorMsg("");
  }

  function onDone() {
    closeWidget(
      `Moon phase on ${info.date}: ${info.emoji} ${info.phaseName} ` +
      `(${(info.illumination * 100).toFixed(1)}% illuminated, ${info.age.toFixed(2)} days into cycle, ${info.trend}).`,
    );
  }

  const markdown = errorMsg ? `**Error:** ${errorMsg}` : buildMarkdown(info);

  return (
    <Form
      header={<CardHeader title="Moon Phase" iconBundleId="com.apple.weather" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Compute" onSubmit={onCompute} style="primary" />
          <Action title="Today" onAction={onToday} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="date"
        label="Date (YYYY-MM-DD)"
        value={date}
        onChange={setDate}
      />
    </Form>
  );
}

const MoonPhaseWidget = defineWidget({
  name: "get_moon_phase",
  description:
    "Compute the moon phase, illumination percentage, lunar age, and time-to-next-new/full for any date. Pure local math — no API or network required.",
  schema,
  component: MoonPhase,
});

export default MoonPhaseWidget;
