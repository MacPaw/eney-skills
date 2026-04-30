import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import markdownit from "markdown-it";
import sanitizeHtml from "sanitize-html";

const schema = z.object({
  markdown: z.string().optional().describe("The Markdown source to convert."),
  breaks: z.boolean().optional().describe("Convert single newlines to <br>. Defaults to false."),
  linkify: z.boolean().optional().describe("Auto-link URLs and emails. Defaults to true."),
});

type Props = z.infer<typeof schema>;

function render(source: string, breaks: boolean, linkify: boolean): string {
  if (!source) return "";
  const md = markdownit({ html: false, breaks, linkify, typographer: true });
  const raw = md.render(source);
  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ["src", "alt", "title"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
  });
}

function ConvertMarkdown(props: Props) {
  const closeWidget = useCloseWidget();
  const [markdown, setMarkdown] = useState(props.markdown ?? "");
  const [breaks, setBreaks] = useState(props.breaks ?? false);
  const [linkify, setLinkify] = useState(props.linkify ?? true);

  const html = useMemo(() => render(markdown, breaks, linkify), [markdown, breaks, linkify]);

  function onDone() {
    if (html) closeWidget(`Converted ${markdown.length} char(s) of Markdown.`);
    else closeWidget("Nothing converted.");
  }

  return (
    <Form
      header={<CardHeader title="Markdown to HTML" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel layout="row">
          {html && <Action.CopyToClipboard title="Copy HTML" content={html} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="markdown" label="Markdown" value={markdown} onChange={setMarkdown} />
      <Form.Checkbox name="breaks" label="Soft breaks → <br>" checked={breaks} onChange={setBreaks} variant="switch" />
      <Form.Checkbox name="linkify" label="Auto-link URLs" checked={linkify} onChange={setLinkify} variant="switch" />
      {html && <Paper markdown={"```html\n" + html + "\n```"} />}
    </Form>
  );
}

const ConvertMarkdownWidget = defineWidget({
  name: "convert-markdown",
  description:
    "Convert Markdown text to HTML. Output is sanitised (no raw HTML, scripts, or unsafe URL schemes). Toggleable soft-break and auto-link behaviour.",
  schema,
  component: ConvertMarkdown,
});

export default ConvertMarkdownWidget;
