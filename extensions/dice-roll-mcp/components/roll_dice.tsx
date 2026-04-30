import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  notation: z
    .string()
    .optional()
    .describe(
      "Dice notation, e.g. '3d6', '2d20+5', '4d6-1'. Supports multiple groups separated by + or -, e.g. '2d6+1d4+3'. Defaults to '1d20'.",
    ),
});

type Props = z.infer<typeof schema>;

interface Term {
  count: number;
  sides: number;
  sign: 1 | -1;
}

interface ParsedNotation {
  terms: Term[];
  modifier: number; // signed, e.g. +5 or -1
}

interface DieRoll {
  sides: number;
  value: number;
  sign: 1 | -1;
}

interface RollResult {
  notation: string;
  groups: { spec: string; rolls: DieRoll[]; subtotal: number }[];
  modifier: number;
  total: number;
}

function parseNotation(input: string): ParsedNotation {
  const cleaned = input.replace(/\s+/g, "").toLowerCase();
  if (!cleaned) throw new Error("Empty notation.");

  // Split on + and - while keeping the sign
  const tokens: { sign: 1 | -1; body: string }[] = [];
  let i = 0;
  let sign: 1 | -1 = 1;
  let buf = "";
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if ((ch === "+" || ch === "-") && i > 0) {
      if (buf) tokens.push({ sign, body: buf });
      sign = ch === "+" ? 1 : -1;
      buf = "";
      i++;
      continue;
    }
    if ((ch === "+" || ch === "-") && i === 0) {
      sign = ch === "+" ? 1 : -1;
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf) tokens.push({ sign, body: buf });

  const terms: Term[] = [];
  let modifier = 0;
  const dieRe = /^(\d*)d(\d+)$/;

  for (const tok of tokens) {
    const m = dieRe.exec(tok.body);
    if (m) {
      const count = m[1] === "" ? 1 : parseInt(m[1], 10);
      const sides = parseInt(m[2], 10);
      if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) {
        throw new Error(`Invalid die: ${tok.body}`);
      }
      if (count > 1000) throw new Error("Too many dice (max 1000).");
      if (sides > 1_000_000) throw new Error("Sides too large.");
      terms.push({ count, sides, sign: tok.sign });
    } else if (/^\d+$/.test(tok.body)) {
      modifier += tok.sign * parseInt(tok.body, 10);
    } else {
      throw new Error(`Could not parse: ${tok.body}`);
    }
  }

  if (terms.length === 0) throw new Error("No dice found in notation.");
  return { terms, modifier };
}

function rollOne(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function rollNotation(notation: string): RollResult {
  const parsed = parseNotation(notation);
  let total = 0;
  const groups: RollResult["groups"] = [];
  for (const term of parsed.terms) {
    const rolls: DieRoll[] = [];
    let subtotal = 0;
    for (let i = 0; i < term.count; i++) {
      const v = rollOne(term.sides);
      rolls.push({ sides: term.sides, value: v, sign: term.sign });
      subtotal += v;
    }
    subtotal *= term.sign;
    total += subtotal;
    groups.push({ spec: `${term.sign === -1 ? "-" : ""}${term.count}d${term.sides}`, rolls, subtotal });
  }
  total += parsed.modifier;
  return { notation, groups, modifier: parsed.modifier, total };
}

function formatRolls(result: RollResult): string {
  const lines: string[] = [];
  lines.push(`### 🎲 Total: **${result.total}**`);
  lines.push("");
  for (const g of result.groups) {
    const values = g.rolls.map((r) => r.value).join(", ");
    lines.push(`- **${g.spec}** → [${values}] = ${g.subtotal >= 0 ? "+" : ""}${g.subtotal}`);
  }
  if (result.modifier !== 0) {
    lines.push(`- modifier: ${result.modifier >= 0 ? "+" : ""}${result.modifier}`);
  }
  lines.push("");
  lines.push(`_Notation: \`${result.notation}\`_`);
  return lines.join("\n");
}

const PRESETS = ["1d20", "2d6", "3d6", "4d6", "1d100", "1d4", "1d8", "1d10", "1d12"];

function RollDice(props: Props) {
  const closeWidget = useCloseWidget();
  const [notation, setNotation] = useState(props.notation ?? "1d20");
  const [result, setResult] = useState<RollResult | null>(() => {
    try {
      return rollNotation(props.notation ?? "1d20");
    } catch {
      return null;
    }
  });
  const [errorMsg, setErrorMsg] = useState("");

  function onRoll() {
    try {
      const r = rollNotation(notation.trim() || "1d20");
      setResult(r);
      setErrorMsg("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setResult(null);
    }
  }

  function onPreset(preset: string) {
    setNotation(preset);
    try {
      setResult(rollNotation(preset));
      setErrorMsg("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setResult(null);
    }
  }

  function onDone() {
    if (result) {
      closeWidget(`Rolled ${result.notation}: total ${result.total}.`);
    } else if (errorMsg) {
      closeWidget(`Error: ${errorMsg}`);
    } else {
      closeWidget("Closed.");
    }
  }

  const markdown = errorMsg
    ? `**Error:** ${errorMsg}`
    : result
      ? formatRolls(result)
      : "_Enter notation and tap Roll._";

  return (
    <Form
      header={<CardHeader title="Dice Roller" iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Roll" onSubmit={onRoll} style="primary" />
          <Action title="Roll Again" onAction={onRoll} style="secondary" />
          {PRESETS.slice(0, 4).map((p) => (
            <Action key={p} title={p} onAction={() => onPreset(p)} style="secondary" />
          ))}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="notation"
        label="Dice notation"
        value={notation}
        onChange={setNotation}
      />
    </Form>
  );
}

const RollDiceWidget = defineWidget({
  name: "roll_dice",
  description:
    "Roll dice using NdM notation, e.g. '3d6', '2d20+5', '4d6-1'. Supports multiple groups (e.g. '2d6+1d4+3'). Includes preset shortcut buttons.",
  schema,
  component: RollDice,
});

export default RollDiceWidget;
