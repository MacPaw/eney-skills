import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { detectCardType, evaluate } from "../helpers/luhn.js";

const schema = z.object({
  number: z.string().optional().describe("Number to validate. Spaces and dashes are stripped before checking."),
});

type Props = z.infer<typeof schema>;

interface Display {
  digits: string;
  isValid: boolean;
  sum: number;
  checkDigit: number;
  suggested: string;
  cardType: string | null;
}

function tryEvaluate(raw: string): Display | { error: string } | null {
  if (!raw.trim()) return null;
  try {
    const r = evaluate(raw);
    return {
      digits: r.digits,
      isValid: r.isValid,
      sum: r.sum,
      checkDigit: r.checkDigit,
      suggested: r.suggestedFullNumber,
      cardType: detectCardType(r.digits),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function maskTail(digits: string): string {
  if (digits.length <= 4) return digits;
  return "•".repeat(digits.length - 4) + digits.slice(-4);
}

function ValidateLuhn(props: Props) {
  const closeWidget = useCloseWidget();
  const [number, setNumber] = useState(props.number ?? "");

  const result = useMemo(() => tryEvaluate(number), [number]);

  function onDone() {
    if (!result) closeWidget("Nothing validated.");
    else if ("error" in result) closeWidget(`Invalid input: ${result.error}`);
    else closeWidget(result.isValid ? "Luhn check passes." : "Luhn check fails.");
  }

  return (
    <Form
      header={<CardHeader title="Luhn Validator" iconBundleId="com.apple.preference.security" />}
      actions={
        <ActionPanel layout="row">
          {result && !("error" in result) && !result.isValid && (
            <Action.CopyToClipboard title="Copy suggested" content={result.suggested} />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="number" label="Number" value={number} onChange={setNumber} />
      {result && "error" in result && <Paper markdown={`**Invalid input:** ${result.error}`} />}
      {result && !("error" in result) && (
        <Paper
          markdown={[
            result.isValid ? "### ✅ Passes Luhn" : "### ❌ Fails Luhn",
            "",
            "| | |",
            "|---|---|",
            `| **Digits** | \`${maskTail(result.digits)}\` (${result.digits.length} digits) |`,
            `| **Sum mod 10** | ${result.sum % 10} |`,
            result.cardType ? `| **Detected** | ${result.cardType} |` : "",
            !result.isValid ? `| **Suggested check digit** | \`${result.checkDigit}\` |` : "",
            !result.isValid ? `| **Suggested full number** | \`${maskTail(result.suggested)}\` |` : "",
          ]
            .filter(Boolean)
            .join("\n")}
        />
      )}
      <Paper markdown="_The number is checked locally; nothing is sent over the network. Sensitive numbers (e.g. card numbers) are never logged or stored._" />
    </Form>
  );
}

const ValidateLuhnWidget = defineWidget({
  name: "validate-luhn",
  description:
    "Validate a Luhn checksum (used by credit cards, IMEI, US National Provider Identifier, etc.). Spaces and dashes are stripped; the widget reports pass/fail, the running sum mod 10, and — when invalid — the check digit that would make it valid. Common card-type prefixes are detected for context.",
  schema,
  component: ValidateLuhn,
});

export default ValidateLuhnWidget;
