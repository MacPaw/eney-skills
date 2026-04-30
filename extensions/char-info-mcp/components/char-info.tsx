import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  input: z.string().optional().describe("A character, or a codepoint like 'U+1F600' / '128512' / '0x1F600'."),
});

type Props = z.infer<typeof schema>;

interface CharFacts {
  char: string;
  codepoint: number;
  utf8Bytes: number[];
  utf16Units: number[];
  isAstral: boolean;
}

function parseInput(raw: string): CharFacts | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let codepoint: number | null = null;

  const upperPrefix = trimmed.toUpperCase();
  if (/^U\+[0-9A-F]+$/i.test(trimmed)) codepoint = Number.parseInt(trimmed.slice(2), 16);
  else if (/^0X[0-9A-F]+$/.test(upperPrefix)) codepoint = Number.parseInt(trimmed.slice(2), 16);
  else if (/^\\U\{[0-9A-F]+\}$/i.test(trimmed)) codepoint = Number.parseInt(trimmed.slice(3, -1), 16);
  else if (/^\\U[0-9A-F]{4}$/i.test(trimmed)) codepoint = Number.parseInt(trimmed.slice(2), 16);
  else if (/^\d+$/.test(trimmed)) codepoint = Number.parseInt(trimmed, 10);

  if (codepoint !== null) {
    if (codepoint < 0 || codepoint > 0x10ffff) return null;
    const char = String.fromCodePoint(codepoint);
    return computeFacts(char);
  }

  const first = [...trimmed][0];
  if (!first) return null;
  return computeFacts(first);
}

function computeFacts(char: string): CharFacts {
  const codepoint = char.codePointAt(0)!;
  const utf8Bytes = Array.from(Buffer.from(char, "utf8"));
  const utf16Units: number[] = [];
  for (let i = 0; i < char.length; i += 1) utf16Units.push(char.charCodeAt(i));
  return { char, codepoint, utf8Bytes, utf16Units, isAstral: codepoint > 0xffff };
}

function pad(n: number, width: number): string {
  return n.toString(16).toUpperCase().padStart(width, "0");
}

function CharInfo(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");

  const facts = useMemo(() => parseInput(input), [input]);

  function onDone() {
    if (!facts) closeWidget("No character parsed.");
    else closeWidget(`U+${pad(facts.codepoint, 4)} (${facts.char})`);
  }

  const lines: string[] = [];
  if (facts) {
    lines.push(`### \`${facts.char}\``);
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| **Codepoint** | \`U+${pad(facts.codepoint, 4)}\` (${facts.codepoint}) |`);
    lines.push(`| **UTF-8** | \`${facts.utf8Bytes.map((b) => pad(b, 2)).join(" ")}\` (${facts.utf8Bytes.length} bytes) |`);
    lines.push(`| **UTF-16** | \`${facts.utf16Units.map((u) => "0x" + pad(u, 4)).join(" ")}\` (${facts.utf16Units.length} units) |`);
    lines.push(`| **HTML** | \`&#${facts.codepoint};\` |`);
    lines.push(`| **JS escape** | \`\\u{${pad(facts.codepoint, 4)}}\` |`);
    lines.push(`| **CSS escape** | \`\\${pad(facts.codepoint, 6)}\` |`);
    if (facts.isAstral) {
      lines.push(`| **Plane** | _Astral (outside BMP)_ |`);
    }
  } else if (input.trim()) {
    lines.push("_Could not parse input. Try a character, `U+1F600`, `0x1F600`, or a decimal number._");
  } else {
    lines.push("Enter a character or codepoint above.");
  }

  return (
    <Form
      header={<CardHeader title="Char Info" iconBundleId="com.apple.fontbook" />}
      actions={
        <ActionPanel layout="row">
          {facts && <Action.CopyToClipboard title="Copy char" content={facts.char} />}
          {facts && (
            <Action.CopyToClipboard
              title="Copy codepoint"
              content={`U+${pad(facts.codepoint, 4)}`}
            />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="Character or codepoint" value={input} onChange={setInput} />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const CharInfoWidget = defineWidget({
  name: "char-info",
  description:
    "Show Unicode codepoint, UTF-8 bytes, UTF-16 units, HTML entity, and JS/CSS escape forms for a single character. Accepts either a literal character or a codepoint in U+XXXX, 0xXXXX, or decimal form.",
  schema,
  component: CharInfo,
});

export default CharInfoWidget;
