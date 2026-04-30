import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().optional().describe("The text to convert."),
});

type Props = z.infer<typeof schema>;

function tokenize(input: string): string[] {
  if (!input) return [];
  const replaced = input
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-./\s]+/g, " ");
  return replaced
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function camelCase(tokens: string[]): string {
  if (!tokens.length) return "";
  return tokens
    .map((t, i) => (i === 0 ? t : t.charAt(0).toUpperCase() + t.slice(1)))
    .join("");
}

function pascalCase(tokens: string[]): string {
  return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("");
}

function snakeCase(tokens: string[]): string {
  return tokens.join("_");
}

function kebabCase(tokens: string[]): string {
  return tokens.join("-");
}

function constantCase(tokens: string[]): string {
  return tokens.join("_").toUpperCase();
}

function titleCase(tokens: string[]): string {
  return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
}

function sentenceCase(tokens: string[]): string {
  if (!tokens.length) return "";
  const joined = tokens.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

interface CaseRow {
  label: string;
  value: string;
}

function CaseRowList(rows: CaseRow[]): string {
  const lines: string[] = ["| Case | Value |", "|---|---|"];
  for (const r of rows) lines.push(`| **${r.label}** | \`${r.value}\` |`);
  return lines.join("\n");
}

function ConvertCase(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");

  const conversions = useMemo(() => {
    const tokens = tokenize(text);
    return {
      camel: camelCase(tokens),
      pascal: pascalCase(tokens),
      snake: snakeCase(tokens),
      kebab: kebabCase(tokens),
      constant: constantCase(tokens),
      title: titleCase(tokens),
      sentence: sentenceCase(tokens),
      lower: tokens.join(" "),
      upper: tokens.join(" ").toUpperCase(),
    };
  }, [text]);

  function onDone() {
    if (!text.trim()) closeWidget("Nothing converted.");
    else closeWidget(`camelCase: ${conversions.camel}`);
  }

  const rows: CaseRow[] = [
    { label: "camelCase", value: conversions.camel },
    { label: "PascalCase", value: conversions.pascal },
    { label: "snake_case", value: conversions.snake },
    { label: "kebab-case", value: conversions.kebab },
    { label: "CONSTANT_CASE", value: conversions.constant },
    { label: "Title Case", value: conversions.title },
    { label: "Sentence case", value: conversions.sentence },
    { label: "lower", value: conversions.lower },
    { label: "UPPER", value: conversions.upper },
  ];

  return (
    <Form
      header={<CardHeader title="Convert Case" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel layout="row">
          {conversions.camel && <Action.CopyToClipboard title="Copy camelCase" content={conversions.camel} />}
          {conversions.snake && <Action.CopyToClipboard title="Copy snake_case" content={conversions.snake} />}
          {conversions.kebab && <Action.CopyToClipboard title="Copy kebab-case" content={conversions.kebab} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      {text.trim() && <Paper markdown={CaseRowList(rows.filter((r) => r.value))} />}
    </Form>
  );
}

const ConvertCaseWidget = defineWidget({
  name: "convert-case",
  description:
    "Convert text between camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Title Case, Sentence case, lower, and UPPER. Auto-tokenizes the input by detecting boundaries in any common case style.",
  schema,
  component: ConvertCase,
});

export default ConvertCaseWidget;
