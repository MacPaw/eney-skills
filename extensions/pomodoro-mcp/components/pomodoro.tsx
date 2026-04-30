import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

type Phase = "work" | "shortBreak" | "longBreak";

const schema = z.object({
  workMinutes: z.number().int().optional().describe("Work phase in minutes. Defaults to 25."),
  shortBreakMinutes: z.number().int().optional().describe("Short break in minutes. Defaults to 5."),
  longBreakMinutes: z.number().int().optional().describe("Long break in minutes. Defaults to 15."),
  cyclesUntilLongBreak: z.number().int().optional().describe("Work phases between long breaks. Defaults to 4."),
});

type Props = z.infer<typeof schema>;

const PHASE_LABELS: Record<Phase, string> = {
  work: "Work",
  shortBreak: "Short break",
  longBreak: "Long break",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function Pomodoro(props: Props) {
  const closeWidget = useCloseWidget();
  const workMin = Math.max(1, props.workMinutes ?? 25);
  const shortMin = Math.max(1, props.shortBreakMinutes ?? 5);
  const longMin = Math.max(1, props.longBreakMinutes ?? 15);
  const cyclesUntilLong = Math.max(1, props.cyclesUntilLongBreak ?? 4);

  const phaseSeconds: Record<Phase, number> = {
    work: workMin * 60,
    shortBreak: shortMin * 60,
    longBreak: longMin * 60,
  };

  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(workMin * 60);
  const [running, setRunning] = useState(false);
  const [completedWork, setCompletedWork] = useState(0);
  const phaseEndRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const end = phaseEndRef.current;
      if (end === null) return;
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        if (phase === "work") {
          const next = completedWork + 1;
          setCompletedWork(next);
          const isLong = next % cyclesUntilLong === 0;
          const nextPhase: Phase = isLong ? "longBreak" : "shortBreak";
          setPhase(nextPhase);
          const nextSeconds = phaseSeconds[nextPhase];
          phaseEndRef.current = Date.now() + nextSeconds * 1000;
          setSecondsLeft(nextSeconds);
        } else {
          setPhase("work");
          phaseEndRef.current = Date.now() + phaseSeconds.work * 1000;
          setSecondsLeft(phaseSeconds.work);
        }
      }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running, phase, completedWork, cyclesUntilLong]);

  function onStart() {
    if (running) return;
    phaseEndRef.current = Date.now() + secondsLeft * 1000;
    setRunning(true);
  }

  function onPause() {
    if (!running) return;
    if (phaseEndRef.current !== null) {
      const remaining = Math.max(0, Math.round((phaseEndRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }
    phaseEndRef.current = null;
    setRunning(false);
  }

  function onSkip() {
    setRunning(false);
    phaseEndRef.current = null;
    if (phase === "work") {
      const next = completedWork + 1;
      setCompletedWork(next);
      const isLong = next % cyclesUntilLong === 0;
      const nextPhase: Phase = isLong ? "longBreak" : "shortBreak";
      setPhase(nextPhase);
      setSecondsLeft(phaseSeconds[nextPhase]);
    } else {
      setPhase("work");
      setSecondsLeft(phaseSeconds.work);
    }
  }

  function onReset() {
    setRunning(false);
    phaseEndRef.current = null;
    setPhase("work");
    setCompletedWork(0);
    setSecondsLeft(phaseSeconds.work);
  }

  function onDone() {
    closeWidget(`${PHASE_LABELS[phase]}: ${formatTime(secondsLeft)} (${completedWork} work cycles complete).`);
  }

  const totalForPhase = phaseSeconds[phase];
  const progress = Math.round(((totalForPhase - secondsLeft) / totalForPhase) * 12);
  const bar = "█".repeat(Math.max(0, Math.min(12, progress))) + "░".repeat(12 - Math.max(0, Math.min(12, progress)));

  return (
    <Form
      header={<CardHeader title={`Pomodoro — ${PHASE_LABELS[phase]}`} iconBundleId="com.apple.clock" />}
      actions={
        <ActionPanel layout="row">
          {running ? (
            <Action title="Pause" onAction={onPause} style="primary" />
          ) : (
            <Action title="Start" onAction={onStart} style="primary" />
          )}
          <Action title="Skip" onAction={onSkip} style="secondary" />
          <Action title="Reset" onAction={onReset} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper
        markdown={[
          `### \`${formatTime(secondsLeft)}\``,
          "",
          `\`${bar}\``,
          "",
          `**${PHASE_LABELS[phase]}** — ${completedWork} work cycle${completedWork === 1 ? "" : "s"} complete`,
          "",
          `Long break every **${cyclesUntilLong}** work cycles.`,
        ].join("\n")}
      />
    </Form>
  );
}

const PomodoroWidget = defineWidget({
  name: "pomodoro",
  description:
    "Pomodoro timer with auto-advancing work, short-break, and long-break phases. Defaults to 25/5/15 min and a long break every 4 work cycles. Pause/Skip/Reset actions are available; widget shows a progress bar and a running cycle count.",
  schema,
  component: Pomodoro,
});

export default PomodoroWidget;
