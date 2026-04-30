import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().describe("The text to analyze."),
  wpm: z
    .number()
    .int()
    .optional()
    .describe("Reading speed in words per minute. Defaults to 238 (average adult)."),
});

type Props = z.infer<typeof schema>;

interface Stats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
  speakingMinutes: number;
}

const SPEAKING_WPM = 130; // average speaking rate

function analyze(text: string, wpm: number): Stats {
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.trim()
    ? text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0).length
    : 0;
  const paragraphs = text.trim()
    ? text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
    : 0;
  return {
    characters,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    readingMinutes: words / wpm,
    speakingMinutes: words / SPEAKING_WPM,
  };
}

function formatTime(minutes: number): string {
  if (minutes <= 0) return "0 seconds";
  if (minutes < 1) {
    const seconds = Math.max(1, Math.round(minutes * 60));
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  if (minutes < 60) {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    if (s === 0) return `${m} min${m === 1 ? "" : "s"}`;
    if (s === 60) return `${m + 1} min${m + 1 === 1 ? "" : "s"}`;
    return `${m} min ${s} sec`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return `${h}h ${m}m`;
}

function buildMarkdown(stats: Stats, wpm: number): string {
  return [
    `### 📖 Reading time: **${formatTime(stats.readingMinutes)}**`,
    ``,
    `_Speaking time: ${formatTime(stats.speakingMinutes)} (at ${SPEAKING_WPM} wpm)_`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Words | **${stats.words.toLocaleString()}** |`,
    `| Characters | ${stats.characters.toLocaleString()} (${stats.charactersNoSpaces.toLocaleString()} no spaces) |`,
    `| Sentences | ${stats.sentences} |`,
    `| Paragraphs | ${stats.paragraphs} |`,
    `| Reading speed | ${wpm} wpm |`,
  ].join("\n");
}

function ReadingTime(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text);
  const [wpm, setWpm] = useState<number>(props.wpm ?? 238);
  const [stats, setStats] = useState<Stats>(() => analyze(props.text, props.wpm ?? 238));

  function onAnalyze() {
    const safeWpm = Math.max(50, Math.min(1500, wpm || 238));
    setStats(analyze(text, safeWpm));
  }

  function onDone() {
    closeWidget(
      `Reading time: ${formatTime(stats.readingMinutes)} (${stats.words} words at ${wpm} wpm). ` +
      `Speaking time: ${formatTime(stats.speakingMinutes)}.`,
    );
  }

  return (
    <Form
      header={<CardHeader title="Reading Time" iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Analyze" onSubmit={onAnalyze} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(stats, wpm)} />
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.NumberField
        name="wpm"
        label="Reading speed (wpm)"
        value={wpm}
        onChange={(v) => setWpm(Number(v) || 238)}
      />
    </Form>
  );
}

const ReadingTimeWidget = defineWidget({
  name: "estimate_reading_time",
  description:
    "Estimate reading time and speaking time for a piece of text. Returns word/sentence/paragraph counts plus minute-level reading and speaking estimates. Configurable reading speed (defaults to 238 wpm, the average adult silent reading speed).",
  schema,
  component: ReadingTime,
});

export default ReadingTimeWidget;
