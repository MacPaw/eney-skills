import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

type Mode = "of" | "what" | "change";

const schema = z.object({
  mode: z.enum(["of", "what", "change"]).optional().describe("'of' = X% of Y; 'what' = X is what % of Y; 'change' = % change from X to Y. Defaults to 'of'."),
  a: z.number().optional().describe("First operand."),
  b: z.number().optional().describe("Second operand."),
});

type Props = z.infer<typeof schema>;

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toString();
  return Number.parseFloat(n.toPrecision(10)).toString();
}

function compute(mode: Mode, a: number | null, b: number | null): { value: number; sentence: string } | null {
  if (a === null || b === null) return null;
  switch (mode) {
    case "of": {
      const value = (a / 100) * b;
      return { value, sentence: `**${formatNumber(a)}%** of **${formatNumber(b)}** = \`${formatNumber(value)}\`` };
    }
    case "what": {
      if (b === 0) return { value: NaN, sentence: "Division by zero." };
      const value = (a / b) * 100;
      return {
        value,
        sentence: `**${formatNumber(a)}** is **${formatNumber(value)}%** of **${formatNumber(b)}**`,
      };
    }
    case "change": {
      if (a === 0) return { value: NaN, sentence: "Division by zero (initial value is 0)." };
      const value = ((b - a) / a) * 100;
      const direction = value > 0 ? "increase" : value < 0 ? "decrease" : "no change";
      return {
        value,
        sentence: `From **${formatNumber(a)}** to **${formatNumber(b)}** is a **${formatNumber(value)}%** ${direction}`,
      };
    }
  }
}

const MODE_LABELS: Record<Mode, { label: string; aLabel: string; bLabel: string }> = {
  of: { label: "X % of Y", aLabel: "Percent (X)", bLabel: "Of (Y)" },
  what: { label: "X is what % of Y", aLabel: "Number (X)", bLabel: "Of (Y)" },
  change: { label: "% change from X to Y", aLabel: "From (X)", bLabel: "To (Y)" },
};

function CalculatePercent(props: Props) {
  const closeWidget = useCloseWidget();
  const [mode, setMode] = useState<Mode>(props.mode ?? "of");
  const [a, setA] = useState<number | null>(props.a ?? null);
  const [b, setB] = useState<number | null>(props.b ?? null);

  const result = useMemo(() => compute(mode, a, b), [mode, a, b]);
  const labels = MODE_LABELS[mode];

  function onDone() {
    if (!result) closeWidget("Nothing to compute.");
    else if (!Number.isFinite(result.value)) closeWidget("Computation invalid.");
    else closeWidget(`Result: ${formatNumber(result.value)}${mode === "of" ? "" : "%"}`);
  }

  return (
    <Form
      header={<CardHeader title="Percent Calculator" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          {result && Number.isFinite(result.value) && (
            <Action.CopyToClipboard
              title="Copy result"
              content={mode === "of" ? formatNumber(result.value) : `${formatNumber(result.value)}%`}
            />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.Dropdown name="mode" label="Mode" value={mode} onChange={(v) => setMode(v as Mode)}>
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <Form.Dropdown.Item key={m} title={MODE_LABELS[m].label} value={m} />
        ))}
      </Form.Dropdown>
      <Form.NumberField name="a" label={labels.aLabel} value={a} onChange={setA} />
      <Form.NumberField name="b" label={labels.bLabel} value={b} onChange={setB} />
      {result && <Paper markdown={result.sentence} />}
    </Form>
  );
}

const CalculatePercentWidget = defineWidget({
  name: "calculate-percent",
  description:
    "Three-mode percentage calculator: 'of' computes X% of Y, 'what' computes 'X is what percent of Y', 'change' computes the percent change from X to Y. Renders a plain-English sentence with the result.",
  schema,
  component: CalculatePercent,
});

export default CalculatePercentWidget;
