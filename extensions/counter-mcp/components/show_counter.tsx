import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  label: z.string().optional().describe("Label / title for what's being counted, e.g. 'Push-ups'."),
  start: z.number().int().optional().describe("Initial value. Defaults to 0."),
  step: z.number().int().optional().describe("Increment / decrement step. Defaults to 1."),
  min: z.number().int().optional().describe("Optional lower bound."),
  max: z.number().int().optional().describe("Optional upper bound."),
});

type Props = z.infer<typeof schema>;

function Counter(props: Props) {
  const closeWidget = useCloseWidget();
  const label = (props.label ?? "Counter").trim() || "Counter";
  const step = Math.max(1, Math.abs(Math.floor(props.step ?? 1)));
  const min = props.min ?? Number.NEGATIVE_INFINITY;
  const max = props.max ?? Number.POSITIVE_INFINITY;

  const [value, setValue] = useState<number>(props.start ?? 0);
  const [history, setHistory] = useState<number[]>([]);

  function clamp(n: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function nudge(delta: number) {
    setValue((v) => {
      const next = clamp(v + delta);
      setHistory((h) => [...h.slice(-49), v]);
      return next;
    });
  }

  function onIncrement() {
    nudge(step);
  }

  function onDecrement() {
    nudge(-step);
  }

  function onReset() {
    setHistory((h) => [...h.slice(-49), value]);
    setValue(props.start ?? 0);
  }

  function onUndo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setValue(last);
      return h.slice(0, -1);
    });
  }

  function onDone() {
    closeWidget(`${label}: ${value}`);
  }

  const range =
    Number.isFinite(min) || Number.isFinite(max)
      ? `Range: ${Number.isFinite(min) ? min : "−∞"}–${Number.isFinite(max) ? max : "+∞"}`
      : "";

  const markdown = [
    `### ${label}`,
    "",
    `# **${value}**`,
    "",
    `_step: ±${step}${range ? ` · ${range}` : ""}_`,
  ].join("\n");

  return (
    <Form
      header={<CardHeader title="Counter" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action title={`+${step}`} onAction={onIncrement} style="primary" />
          <Action title={`-${step}`} onAction={onDecrement} style="secondary" />
          <Action title="Undo" onAction={onUndo} style="secondary" />
          <Action title="Reset" onAction={onReset} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const CounterWidget = defineWidget({
  name: "show_counter",
  description:
    "A simple counter widget for tallying things. Configurable label, start value, step, and optional min/max bounds. Supports increment, decrement, undo, and reset.",
  schema,
  component: Counter,
});

export default CounterWidget;
