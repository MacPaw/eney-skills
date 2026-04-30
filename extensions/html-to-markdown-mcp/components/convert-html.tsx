import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import TurndownService from "turndown";

const schema = z.object({
  html: z.string().optional().describe("The HTML source to convert."),
  bullets: z.enum(["dash", "star", "plus"]).optional().describe("Bullet character for unordered lists. Defaults to 'dash'."),
  fenced: z.boolean().optional().describe("Use fenced code blocks (```) instead of indented. Defaults to true."),
});

type Props = z.infer<typeof schema>;

interface ConvertResult {
  ok: true;
  markdown: string;
}

interface ConvertError {
  ok: false;
  error: string;
}

const BULLETS: Record<NonNullable<Props["bullets"]>, "-" | "*" | "+"> = {
  dash: "-",
  star: "*",
  plus: "+",
};

function convert(html: string, bullets: NonNullable<Props["bullets"]>, fenced: boolean): ConvertResult | ConvertError | null {
  if (!html.trim()) return null;
  try {
    const service = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: BULLETS[bullets],
      codeBlockStyle: fenced ? "fenced" : "indented",
      emDelimiter: "_",
    });
    const md = service.turndown(html);
    return { ok: true, markdown: md };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function ConvertHtml(props: Props) {
  const closeWidget = useCloseWidget();
  const [html, setHtml] = useState(props.html ?? "");
  const [bullets, setBullets] = useState<NonNullable<Props["bullets"]>>(props.bullets ?? "dash");
  const [fenced, setFenced] = useState(props.fenced ?? true);

  const result = useMemo(() => convert(html, bullets, fenced), [html, bullets, fenced]);

  function onDone() {
    if (!result) closeWidget("Nothing to convert.");
    else if (!result.ok) closeWidget(`Error: ${result.error}`);
    else closeWidget(`Converted to ${result.markdown.length} character(s) of Markdown.`);
  }

  return (
    <Form
      header={<CardHeader title="HTML to Markdown" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel layout="row">
          {result?.ok && <Action.CopyToClipboard title="Copy Markdown" content={result.markdown} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="html" label="HTML" value={html} onChange={setHtml} />
      <Form.Dropdown
        name="bullets"
        label="List bullet"
        value={bullets}
        onChange={(v) => setBullets(v as NonNullable<Props["bullets"]>)}
      >
        <Form.Dropdown.Item title="- (dash)" value="dash" />
        <Form.Dropdown.Item title="* (star)" value="star" />
        <Form.Dropdown.Item title="+ (plus)" value="plus" />
      </Form.Dropdown>
      <Form.Checkbox
        name="fenced"
        label="Fenced code blocks"
        checked={fenced}
        onChange={setFenced}
        variant="switch"
      />
      {result && !result.ok && <Paper markdown={`**Error:** ${result.error}`} />}
      {result?.ok && result.markdown && <Paper markdown={"```markdown\n" + result.markdown + "\n```"} />}
    </Form>
  );
}

const ConvertHtmlWidget = defineWidget({
  name: "convert-html",
  description:
    "Convert HTML to Markdown via the turndown library. Configurable list bullet character and fenced vs indented code blocks. Headings use ATX style (#).",
  schema,
  component: ConvertHtml,
});

export default ConvertHtmlWidget;
