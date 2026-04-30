import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const xmlFormat = require("xml-formatter") as ((xml: string, options?: { indentation?: string; collapseContent?: boolean; lineSeparator?: string }) => string) & {
  minify: (xml: string, options?: { collapseContent?: boolean }) => string;
};

type Mode = "pretty" | "minify";

const schema = z.object({
  input: z.string().optional().describe("The XML text to process."),
  mode: z.enum(["pretty", "minify"]).optional().describe("Output mode: pretty (indented) or minify (one line). Defaults to pretty."),
  indent: z.number().int().optional().describe("Indent width in spaces for pretty mode. Defaults to 2."),
});

type Props = z.infer<typeof schema>;

interface FormatOk {
  ok: true;
  output: string;
}

interface FormatErr {
  ok: false;
  error: string;
}

function format(input: string, mode: Mode, indent: number): FormatOk | FormatErr | null {
  if (!input.trim()) return null;
  try {
    const output =
      mode === "minify"
        ? xmlFormat.minify(input, { collapseContent: true })
        : xmlFormat(input, { indentation: " ".repeat(Math.max(0, Math.min(8, indent))), collapseContent: true });
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function FormatXml(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");
  const [mode, setMode] = useState<Mode>(props.mode ?? "pretty");
  const [indent, setIndent] = useState<number | null>(props.indent ?? 2);

  const result = useMemo(() => format(input, mode, indent ?? 2), [input, mode, indent]);

  function onDone() {
    if (!result) closeWidget("Nothing to format.");
    else if (!result.ok) closeWidget(`Invalid XML: ${result.error}`);
    else closeWidget(mode === "minify" ? "XML minified." : "XML pretty-printed.");
  }

  return (
    <Form
      header={<CardHeader title="XML Formatter" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {result?.ok && <Action.CopyToClipboard title="Copy" content={result.output} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="XML" value={input} onChange={setInput} />
      <Form.Dropdown name="mode" label="Mode" value={mode} onChange={(v) => setMode(v as Mode)}>
        <Form.Dropdown.Item title="Pretty (indented)" value="pretty" />
        <Form.Dropdown.Item title="Minify (one line)" value="minify" />
      </Form.Dropdown>
      {mode === "pretty" && (
        <Form.NumberField name="indent" label="Indent" value={indent} onChange={setIndent} min={0} max={8} />
      )}
      {result && !result.ok && <Paper markdown={`**Invalid XML:** ${result.error}`} />}
      {result?.ok && <Paper markdown={"```xml\n" + result.output + "\n```"} />}
    </Form>
  );
}

const FormatXmlWidget = defineWidget({
  name: "format-xml",
  description: "Pretty-print or minify XML. Invalid XML surfaces the parser error inline.",
  schema,
  component: FormatXml,
});

export default FormatXmlWidget;
