import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

type Base = "2" | "8" | "10" | "16";

const schema = z.object({
  input: z.string().optional().describe("The number to convert (digits valid for the chosen base)."),
  fromBase: z.enum(["2", "8", "10", "16"]).optional().describe("Source base. Defaults to '10'."),
});

type Props = z.infer<typeof schema>;

interface ParseOk {
  ok: true;
  value: bigint;
  negative: boolean;
}

interface ParseErr {
  ok: false;
  error: string;
}

const VALID_DIGITS: Record<Base, RegExp> = {
  "2": /^-?[01]+$/,
  "8": /^-?[0-7]+$/,
  "10": /^-?\d+$/,
  "16": /^-?[0-9a-fA-F]+$/,
};

function parseInBase(raw: string, base: Base): ParseOk | ParseErr | null {
  const stripped = raw.trim().replace(/^0[bB]|^0[oO]|^0[xX]/, "").replace(/[\s_]/g, "");
  if (!stripped) return null;
  if (!VALID_DIGITS[base].test(stripped)) {
    return { ok: false, error: `Input contains digits invalid for base ${base}.` };
  }
  const negative = stripped.startsWith("-");
  const body = negative ? stripped.slice(1) : stripped;
  let value = 0n;
  const radix = BigInt(Number.parseInt(base, 10));
  for (const ch of body.toLowerCase()) {
    const d = "0123456789abcdef".indexOf(ch);
    if (d < 0 || d >= Number(radix)) return { ok: false, error: `Invalid digit '${ch}' for base ${base}.` };
    value = value * radix + BigInt(d);
  }
  return { ok: true, value, negative };
}

function format(value: bigint, negative: boolean, base: number): string {
  const abs = value.toString(base).toUpperCase();
  return negative ? `-${abs}` : abs;
}

const BASE_LABELS: Record<Base, string> = { "2": "Binary", "8": "Octal", "10": "Decimal", "16": "Hexadecimal" };
const BASE_PREFIX: Record<Base, string> = { "2": "0b", "8": "0o", "10": "", "16": "0x" };

function ConvertBase(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");
  const [fromBase, setFromBase] = useState<Base>(props.fromBase ?? "10");

  const parsed = useMemo(() => parseInBase(input, fromBase), [input, fromBase]);

  function onDone() {
    if (!parsed) closeWidget("Nothing converted.");
    else if (!parsed.ok) closeWidget(`Invalid: ${parsed.error}`);
    else closeWidget(`= ${format(parsed.value, parsed.negative, 10)} (decimal)`);
  }

  const targets: Base[] = ["2", "8", "10", "16"];

  return (
    <Form
      header={<CardHeader title="Number Base Converter" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          {parsed?.ok && (
            <Action.CopyToClipboard
              title="Copy decimal"
              content={format(parsed.value, parsed.negative, 10)}
            />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="Number" value={input} onChange={setInput} />
      <Form.Dropdown name="fromBase" label="From base" value={fromBase} onChange={(v) => setFromBase(v as Base)}>
        {(Object.keys(BASE_LABELS) as Base[]).map((b) => (
          <Form.Dropdown.Item key={b} title={`${BASE_LABELS[b]} (base ${b})`} value={b} />
        ))}
      </Form.Dropdown>
      {parsed && !parsed.ok && <Paper markdown={`**Invalid:** ${parsed.error}`} />}
      {parsed?.ok && (
        <Paper
          markdown={[
            "| Base | Value |",
            "|---|---|",
            ...targets.map((b) => {
              const formatted = format(parsed.value, parsed.negative, Number.parseInt(b, 10));
              const prefixed = BASE_PREFIX[b] ? `${BASE_PREFIX[b]}${formatted.replace(/^-/, "")}` : formatted;
              const display = parsed.negative && BASE_PREFIX[b] ? `-${prefixed}` : prefixed;
              return `| ${BASE_LABELS[b]} | \`${display}\` |`;
            }),
          ].join("\n")}
        />
      )}
    </Form>
  );
}

const ConvertBaseWidget = defineWidget({
  name: "convert-base",
  description:
    "Convert an integer between binary, octal, decimal, and hexadecimal. Source-base prefix (0b, 0o, 0x) is auto-stripped; whitespace and underscores between digits are ignored. Uses BigInt internally so large values don't lose precision.",
  schema,
  component: ConvertBase,
});

export default ConvertBaseWidget;
