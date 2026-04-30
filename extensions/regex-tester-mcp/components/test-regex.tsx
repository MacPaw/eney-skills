import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  pattern: z.string().optional().describe("The regular expression pattern (without delimiters)."),
  flags: z.string().optional().describe("Regex flags, e.g. 'gi', 'gm'. Defaults to 'g'."),
  text: z.string().optional().describe("The text to test the regex against."),
});

type Props = z.infer<typeof schema>;

interface MatchInfo {
  match: string;
  index: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

interface RegexResult {
  ok: true;
  matches: MatchInfo[];
}

interface RegexError {
  ok: false;
  error: string;
}

function evaluate(pattern: string, flags: string, text: string): RegexResult | RegexError | null {
  if (!pattern) return null;
  let normalizedFlags = flags;
  if (!normalizedFlags.includes("g")) normalizedFlags += "g";
  let re: RegExp;
  try {
    re = new RegExp(pattern, normalizedFlags);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const matches: MatchInfo[] = [];
  let safeguard = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({
      match: m[0],
      index: m.index,
      groups: m.slice(1),
      namedGroups: m.groups ? { ...m.groups } : {},
    });
    if (m[0] === "" && re.lastIndex === m.index) re.lastIndex += 1;
    safeguard += 1;
    if (safeguard > 1000) break;
  }
  return { ok: true, matches };
}

function escapeMarkdown(s: string): string {
  return s.replace(/[\\`*_{}[\]()#+\-.!|]/g, (c) => `\\${c}`);
}

function highlight(text: string, matches: MatchInfo[]): string {
  if (!matches.length) return "_No matches._";
  const out: string[] = [];
  let cursor = 0;
  for (const m of matches) {
    out.push(escapeMarkdown(text.slice(cursor, m.index)));
    out.push(`**\`${m.match || "∅"}\`**`);
    cursor = m.index + m.match.length;
  }
  out.push(escapeMarkdown(text.slice(cursor)));
  return out.join("");
}

function TestRegex(props: Props) {
  const closeWidget = useCloseWidget();
  const [pattern, setPattern] = useState(props.pattern ?? "");
  const [flags, setFlags] = useState(props.flags ?? "g");
  const [text, setText] = useState(props.text ?? "");

  const result = useMemo(() => evaluate(pattern, flags, text), [pattern, flags, text]);

  function onDone() {
    if (!result) closeWidget("No regex tested.");
    else if (!result.ok) closeWidget(`Invalid regex: ${result.error}`);
    else closeWidget(`${result.matches.length} match(es) found.`);
  }

  const lines: string[] = [];
  if (!pattern) {
    lines.push("Enter a pattern above.");
  } else if (!result) {
    lines.push("");
  } else if (!result.ok) {
    lines.push(`**Invalid regex:** ${result.error}`);
  } else if (!text) {
    lines.push("_Enter test text to see matches._");
  } else {
    lines.push(`**${result.matches.length} match(es)**`);
    lines.push("");
    lines.push(highlight(text, result.matches));
    if (result.matches.length) {
      lines.push("");
      lines.push("### Matches");
      result.matches.forEach((m, i) => {
        lines.push(`${i + 1}. \`${m.match}\` at index ${m.index}`);
        if (m.groups.length) {
          m.groups.forEach((g, gi) => {
            lines.push(`   - group ${gi + 1}: \`${g ?? ""}\``);
          });
        }
        for (const [name, value] of Object.entries(m.namedGroups)) {
          lines.push(`   - \`${name}\`: \`${value}\``);
        }
      });
    }
  }

  return (
    <Form
      header={<CardHeader title="Regex Tester" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel>
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="pattern" label="Pattern" value={pattern} onChange={setPattern} />
      <Form.TextField name="flags" label="Flags" value={flags} onChange={setFlags} />
      <Form.TextField name="text" label="Test text" value={text} onChange={setText} />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const TestRegexWidget = defineWidget({
  name: "test-regex",
  description:
    "Test a JavaScript regular expression against sample text. Shows each match with its index, numbered groups, and named groups. The 'g' flag is added automatically if missing so all matches are reported.",
  schema,
  component: TestRegex,
});

export default TestRegexWidget;
