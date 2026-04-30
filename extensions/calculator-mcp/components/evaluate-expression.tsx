import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { evaluateExpression } from "../helpers/eval.js";

const schema = z.object({
  expression: z.string().optional().describe("The math expression, e.g. '2*(3+4)/sqrt(2)' or '5^3 + log(100)'."),
});

type Props = z.infer<typeof schema>;

interface EvalOk {
  ok: true;
  value: number;
}

interface EvalErr {
  ok: false;
  error: string;
}

function evaluate(expr: string): EvalOk | EvalErr | null {
  if (!expr.trim()) return null;
  try {
    return { ok: true, value: evaluateExpression(expr) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential();
  return Number.parseFloat(n.toPrecision(12)).toString();
}

function EvaluateExpression(props: Props) {
  const closeWidget = useCloseWidget();
  const [expression, setExpression] = useState(props.expression ?? "");

  const result = useMemo(() => evaluate(expression), [expression]);

  function onDone() {
    if (!result) closeWidget("Nothing to evaluate.");
    else if (!result.ok) closeWidget(`Error: ${result.error}`);
    else closeWidget(`${expression} = ${formatNumber(result.value)}`);
  }

  return (
    <Form
      header={<CardHeader title="Calculator" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          {result?.ok && (
            <Action.CopyToClipboard title="Copy result" content={formatNumber(result.value)} />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="expression" label="Expression" value={expression} onChange={setExpression} />
      {result && !result.ok && <Paper markdown={`**Error:** ${result.error}`} />}
      {result?.ok && (
        <Paper markdown={`### ${formatNumber(result.value)}\n\n\`${expression}\``} />
      )}
      {!expression.trim() && (
        <Paper markdown="Supports `+ - * / % ^`, parentheses, and `sqrt`, `abs`, `floor`, `ceil`, `round`, `log`, `log2`, `log10`, `ln`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `exp`, `min`, `max`, `pow`, `pi`, `e`." />
      )}
    </Form>
  );
}

const EvaluateExpressionWidget = defineWidget({
  name: "evaluate-expression",
  description:
    "Safely evaluate a math expression. Supports +, -, *, /, %, ^ (power), parentheses, and common functions: sqrt, abs, floor, ceil, round, log, log2, log10, ln, sin, cos, tan, asin, acos, atan, exp, min, max, pow. Constants: pi, e.",
  schema,
  component: EvaluateExpression,
});

export default EvaluateExpressionWidget;
