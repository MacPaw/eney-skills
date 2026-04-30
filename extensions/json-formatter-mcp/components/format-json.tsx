import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

type Mode = "pretty" | "minify";

const schema = z.object({
  input: z.string().optional().describe("The JSON text to process."),
  mode: z.enum(["pretty", "minify"]).optional().describe("Output mode: pretty (indented) or minify (one line). Defaults to pretty."),
  indent: z.number().int().optional().describe("Indent width in spaces for pretty mode. Defaults to 2."),
});

type Props = z.infer<typeof schema>;

interface ParseResult {
  ok: true;
  parsed: unknown;
  size: number;
}

interface ParseError {
  ok: false;
  error: string;
}

function parse(input: string): ParseResult | ParseError | null {
  if (!input.trim()) return null;
  try {
    const parsed = JSON.parse(input);
    return { ok: true, parsed, size: input.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function FormatJson(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");
  const [mode, setMode] = useState<Mode>(props.mode ?? "pretty");
  const [indent, setIndent] = useState<number | null>(props.indent ?? 2);

  const result = useMemo(() => parse(input), [input]);

  const output = useMemo(() => {
    if (!result || !result.ok) return "";
    if (mode === "minify") return JSON.stringify(result.parsed);
    return JSON.stringify(result.parsed, null, Math.max(0, Math.min(8, indent ?? 2)));
  }, [result, mode, indent]);

  function onDone() {
    if (!result) closeWidget("Nothing to format.");
    else if (!result.ok) closeWidget(`Invalid JSON: ${result.error}`);
    else if (mode === "minify") closeWidget(`Minified: ${result.size} → ${output.length} chars.`);
    else closeWidget(`Pretty-printed JSON.`);
  }

  return (
    <Form
      header={<CardHeader title="JSON Formatter" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {output && <Action.CopyToClipboard title="Copy" content={output} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="JSON" value={input} onChange={setInput} />
      <Form.Dropdown name="mode" label="Mode" value={mode} onChange={(v) => setMode(v as Mode)}>
        <Form.Dropdown.Item title="Pretty (indented)" value="pretty" />
        <Form.Dropdown.Item title="Minify (one line)" value="minify" />
      </Form.Dropdown>
      {mode === "pretty" && (
        <Form.NumberField name="indent" label="Indent" value={indent} onChange={setIndent} min={0} max={8} />
      )}
      {result && !result.ok && <Paper markdown={`**Invalid JSON:** ${result.error}`} />}
      {result && result.ok && output && <Paper markdown={"```json\n" + output + "\n```"} />}
    </Form>
  );
}

const FormatJsonWidget = defineWidget({
  name: "format-json",
  description: "Pretty-print or minify JSON. Invalid JSON surfaces the parser error inline.",
  schema,
  component: FormatJson,
});

export default FormatJsonWidget;
