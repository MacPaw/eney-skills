import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { extractHeadings, renderToc } from "../helpers/toc.js";

const schema = z.object({
  markdown: z.string().optional().describe("The Markdown source to extract headings from."),
  minLevel: z.number().int().optional().describe("Minimum heading level to include (1-6). Defaults to 2."),
  maxLevel: z.number().int().optional().describe("Maximum heading level to include (1-6). Defaults to 4."),
  indent: z.number().int().optional().describe("Spaces per nesting level. Defaults to 2."),
});

type Props = z.infer<typeof schema>;

function GenerateToc(props: Props) {
  const closeWidget = useCloseWidget();
  const [markdown, setMarkdown] = useState(props.markdown ?? "");
  const [minLevel, setMinLevel] = useState<number | null>(props.minLevel ?? 2);
  const [maxLevel, setMaxLevel] = useState<number | null>(props.maxLevel ?? 4);
  const [indent, setIndent] = useState<number | null>(props.indent ?? 2);

  const headings = useMemo(() => {
    const lo = Math.max(1, Math.min(6, minLevel ?? 2));
    const hi = Math.max(lo, Math.min(6, maxLevel ?? 4));
    return extractHeadings(markdown, lo, hi);
  }, [markdown, minLevel, maxLevel]);

  const toc = useMemo(() => renderToc(headings, Math.max(0, Math.min(8, indent ?? 2))), [headings, indent]);

  function onDone() {
    if (!toc) closeWidget(headings.length === 0 ? "No matching headings." : "TOC empty.");
    else closeWidget(`Generated TOC with ${headings.length} entries.`);
  }

  return (
    <Form
      header={<CardHeader title="Markdown TOC" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel layout="row">
          {toc && <Action.CopyToClipboard title="Copy TOC" content={toc} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="markdown" label="Markdown" value={markdown} onChange={setMarkdown} />
      <Form.NumberField name="minLevel" label="Min level" value={minLevel} onChange={setMinLevel} min={1} max={6} />
      <Form.NumberField name="maxLevel" label="Max level" value={maxLevel} onChange={setMaxLevel} min={1} max={6} />
      <Form.NumberField name="indent" label="Indent (spaces)" value={indent} onChange={setIndent} min={0} max={8} />
      {toc && <Paper markdown={"```markdown\n" + toc + "\n```"} />}
      {!toc && markdown.trim() && <Paper markdown="_No headings matched the level range._" />}
    </Form>
  );
}

const GenerateTocWidget = defineWidget({
  name: "generate-toc",
  description:
    "Generate a Markdown table of contents from headings in a Markdown source. Configurable level range (1-6), indentation, and slug generation matches GitHub's anchor convention. Headings inside fenced code blocks are skipped, and duplicate slugs get '-1', '-2', ... suffixes.",
  schema,
  component: GenerateToc,
});

export default GenerateTocWidget;
