import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { fib, fibSequence } from "../helpers/fib.js";

const schema = z.object({
  n: z
    .number()
    .int()
    .optional()
    .describe("Index. For 'term' mode this is N; for 'sequence' mode it's the upper bound (inclusive). Defaults to 10."),
  mode: z
    .enum(["term", "sequence"])
    .optional()
    .describe("'term' (default) returns F(n); 'sequence' returns F(0)..F(n)."),
});

type Props = z.infer<typeof schema>;

interface ComputedTerm {
  kind: "term";
  n: number;
  value: bigint;
}

interface ComputedSequence {
  kind: "sequence";
  limit: number;
  values: bigint[];
}

type Computed = ComputedTerm | ComputedSequence | { kind: "error"; error: string };

function compute(n: number, mode: "term" | "sequence"): Computed {
  try {
    if (mode === "term") {
      return { kind: "term", n, value: fib(n) };
    }
    return { kind: "sequence", limit: n, values: fibSequence(n) };
  } catch (err) {
    return { kind: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

function buildMarkdown(c: Computed): string {
  if (c.kind === "error") return `**Error:** ${c.error}`;
  if (c.kind === "term") {
    const s = c.value.toString();
    const digits = s.length;
    const preview = digits > 200 ? s.slice(0, 200) + "…" : s;
    return [
      `### F(${c.n}) =`,
      "",
      `\`\`\``,
      preview,
      `\`\`\``,
      "",
      `_${digits.toLocaleString()} digit${digits === 1 ? "" : "s"}_`,
    ].join("\n");
  }
  const cells = c.values.map((v, i) => `F(${i}) = ${v.toString()}`);
  const text = cells.join("\n");
  return [
    `### Fibonacci sequence F(0)..F(${c.limit}) (${c.values.length} terms)`,
    "",
    "```",
    text,
    "```",
  ].join("\n");
}

function Fibonacci(props: Props) {
  const closeWidget = useCloseWidget();
  const [n, setN] = useState<number>(props.n ?? 10);
  const [mode, setMode] = useState<"term" | "sequence">(props.mode ?? "term");
  const [computed, setComputed] = useState<Computed>(() => compute(props.n ?? 10, props.mode ?? "term"));

  function onCompute() {
    setComputed(compute(n, mode));
  }

  function onTerm() {
    setMode("term");
    setComputed(compute(n, "term"));
  }

  function onSequence() {
    setMode("sequence");
    setComputed(compute(n, "sequence"));
  }

  function onIncrement() {
    const next = Math.max(0, n + 1);
    setN(next);
    setComputed(compute(next, mode));
  }

  function onDone() {
    if (computed.kind === "error") {
      closeWidget(`Error: ${computed.error}`);
    } else if (computed.kind === "term") {
      closeWidget(`F(${computed.n}) = ${computed.value.toString()}`);
    } else {
      const sample = computed.values.slice(0, 10).map((v) => v.toString()).join(", ");
      closeWidget(`Fibonacci F(0)..F(${computed.limit}): ${sample}${computed.values.length > 10 ? ", …" : ""}`);
    }
  }

  return (
    <Form
      header={<CardHeader title={`Fibonacci (${mode})`} iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Compute" onSubmit={onCompute} style="primary" />
          <Action title="N+1" onAction={onIncrement} style="secondary" />
          <Action
            title={mode === "term" ? "Show sequence" : "Show single term"}
            onAction={mode === "term" ? onSequence : onTerm}
            style="secondary"
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(computed)} />
      <Form.NumberField
        name="n"
        label="N"
        value={n}
        onChange={(v) => setN(Math.max(0, Math.floor(Number(v) || 0)))}
      />
    </Form>
  );
}

const FibonacciWidget = defineWidget({
  name: "fibonacci",
  description:
    "Compute the Nth Fibonacci number or the full F(0)..F(N) sequence using BigInt arithmetic — no precision loss for very large terms. 'term' mode supports N up to 20,000; 'sequence' mode caps the upper bound at 200.",
  schema,
  component: Fibonacci,
});

export default FibonacciWidget;
