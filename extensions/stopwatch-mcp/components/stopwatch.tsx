import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({});

type Props = z.infer<typeof schema>;

interface Lap {
  index: number;
  totalMs: number;
  splitMs: number;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
  return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
}

function Stopwatch(_props: Props) {
  const closeWidget = useCloseWidget();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      const start = startedAtRef.current ?? now;
      setElapsed(accumulatedRef.current + (now - start));
    }, 47);
    return () => clearInterval(id);
  }, [running]);

  function onStart() {
    if (running) return;
    startedAtRef.current = Date.now();
    setRunning(true);
  }

  function onStop() {
    if (!running) return;
    const now = Date.now();
    const start = startedAtRef.current ?? now;
    accumulatedRef.current += now - start;
    startedAtRef.current = null;
    setElapsed(accumulatedRef.current);
    setRunning(false);
  }

  function onLap() {
    const previousTotal = laps.length ? laps[laps.length - 1].totalMs : 0;
    const splitMs = elapsed - previousTotal;
    setLaps((prev) => [...prev, { index: prev.length + 1, totalMs: elapsed, splitMs }]);
  }

  function onReset() {
    accumulatedRef.current = 0;
    startedAtRef.current = running ? Date.now() : null;
    setElapsed(0);
    setLaps([]);
  }

  function onDone() {
    closeWidget(`Stopwatch: ${formatDuration(elapsed)}.`);
  }

  const lapLines: string[] = [];
  if (laps.length) {
    lapLines.push("");
    lapLines.push("| # | Split | Total |");
    lapLines.push("|---|---|---|");
    for (const lap of [...laps].reverse()) {
      lapLines.push(`| ${lap.index} | \`${formatDuration(lap.splitMs)}\` | \`${formatDuration(lap.totalMs)}\` |`);
    }
  }

  return (
    <Form
      header={<CardHeader title="Stopwatch" iconBundleId="com.apple.clock" />}
      actions={
        <ActionPanel layout="row">
          {running ? (
            <Action title="Stop" onAction={onStop} style="primary" />
          ) : (
            <Action title="Start" onAction={onStart} style="primary" />
          )}
          <Action title="Lap" onAction={onLap} style="secondary" isDisabled={!running} />
          <Action title="Reset" onAction={onReset} style="secondary" isDisabled={elapsed === 0 && laps.length === 0} />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={`### \`${formatDuration(elapsed)}\`${lapLines.join("\n")}`} />
    </Form>
  );
}

const StopwatchWidget = defineWidget({
  name: "stopwatch",
  description:
    "An in-widget stopwatch with start, stop, lap, and reset. Time stays accurate across pause/resume by accumulating elapsed deltas rather than tick counts.",
  schema,
  component: Stopwatch,
});

export default StopwatchWidget;
