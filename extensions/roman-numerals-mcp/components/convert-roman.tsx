import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { MAX_INT, MIN_INT, intToRoman, romanToInt } from "../helpers/roman.js";

const schema = z.object({
  input: z.string().optional().describe("Either an integer (1-3999) or a Roman numeral (e.g. 'MCMXCIV')."),
});

type Props = z.infer<typeof schema>;

interface ConversionOk {
  ok: true;
  forward: string;
  backward: string;
  detected: "integer" | "roman";
}

interface ConversionErr {
  ok: false;
  error: string;
}

function convert(input: string): ConversionOk | ConversionErr | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    if (/^\d+$/.test(trimmed)) {
      const n = Number.parseInt(trimmed, 10);
      const roman = intToRoman(n);
      return { ok: true, forward: roman, backward: String(n), detected: "integer" };
    }
    const n = romanToInt(trimmed);
    const roman = intToRoman(n);
    return { ok: true, forward: String(n), backward: roman, detected: "roman" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function ConvertRoman(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");

  const result = useMemo(() => convert(input), [input]);

  function onDone() {
    if (!result) closeWidget("Nothing converted.");
    else if (!result.ok) closeWidget(`Invalid: ${result.error}`);
    else closeWidget(`${result.backward} → ${result.forward}`);
  }

  return (
    <Form
      header={<CardHeader title="Roman Numerals" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {result?.ok && <Action.CopyToClipboard title="Copy" content={result.forward} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="Integer or Roman numeral" value={input} onChange={setInput} />
      {result && !result.ok && <Paper markdown={`**Invalid:** ${result.error}`} />}
      {result?.ok && (
        <Paper
          markdown={[
            `### \`${result.forward}\``,
            "",
            `_${result.detected === "integer" ? "Integer → Roman" : "Roman → Integer"}_`,
            "",
            `\`${result.backward}\` ↔ \`${result.forward}\``,
          ].join("\n")}
        />
      )}
      {!input.trim() && (
        <Paper markdown={`Enter an integer (${MIN_INT}-${MAX_INT}) or a Roman numeral above.`} />
      )}
    </Form>
  );
}

const ConvertRomanWidget = defineWidget({
  name: "convert-roman",
  description:
    "Convert between integers and Roman numerals (1-3999). Auto-detects direction based on whether the input is digits or letters. Rejects non-canonical forms (e.g. 'IIII', 'VV') so the output is always the standard subtractive form.",
  schema,
  component: ConvertRoman,
});

export default ConvertRomanWidget;
