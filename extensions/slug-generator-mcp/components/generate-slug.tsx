import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().optional().describe("The text to slugify."),
  separator: z.string().optional().describe("Separator character. Defaults to '-'."),
  lowercase: z.boolean().optional().describe("Lowercase the slug. Defaults to true."),
  maxLength: z.number().int().optional().describe("Truncate the slug to at most this many characters. 0 means no limit."),
});

type Props = z.infer<typeof schema>;

function slugify(text: string, separator: string, lowercase: boolean, maxLength: number): string {
  if (!text) return "";
  let s = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  if (lowercase) s = s.toLowerCase();
  s = s.replace(/[^a-zA-Z0-9]+/g, separator);
  const escaped = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  s = s.replace(new RegExp(`^${escaped}+|${escaped}+$`, "g"), "");
  if (maxLength > 0 && s.length > maxLength) {
    s = s.slice(0, maxLength).replace(new RegExp(`${escaped}+$`), "");
  }
  return s;
}

function GenerateSlug(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [separator, setSeparator] = useState(props.separator ?? "-");
  const [lowercase, setLowercase] = useState(props.lowercase ?? true);
  const [maxLength, setMaxLength] = useState<number | null>(props.maxLength ?? 0);

  const slug = useMemo(
    () => slugify(text, separator || "-", lowercase, maxLength ?? 0),
    [text, separator, lowercase, maxLength],
  );

  function onDone() {
    if (slug) closeWidget(`Slug: ${slug}`);
    else closeWidget("Nothing slugified.");
  }

  return (
    <Form
      header={<CardHeader title="Generate Slug" iconBundleId="com.apple.Safari" />}
      actions={
        <ActionPanel layout="row">
          {slug && <Action.CopyToClipboard title="Copy" content={slug} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.TextField name="separator" label="Separator" value={separator} onChange={setSeparator} />
      <Form.Checkbox
        name="lowercase"
        label="Lowercase"
        checked={lowercase}
        onChange={setLowercase}
        variant="switch"
      />
      <Form.NumberField
        name="maxLength"
        label="Max length (0 = no limit)"
        value={maxLength}
        onChange={setMaxLength}
        min={0}
        max={500}
      />
      {slug && <Paper markdown={"```\n" + slug + "\n```"} />}
    </Form>
  );
}

const GenerateSlugWidget = defineWidget({
  name: "generate-slug",
  description:
    "Convert text to a URL-friendly slug. Strips diacritics, lowercases (optional), replaces non-alphanumeric runs with the chosen separator, and trims leading/trailing separators.",
  schema,
  component: GenerateSlug,
});

export default GenerateSlugWidget;
