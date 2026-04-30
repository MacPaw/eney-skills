import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().optional().describe("The text to count."),
});

type Props = z.infer<typeof schema>;

interface Counts {
  words: number;
  charsAll: number;
  charsNoWhitespace: number;
  lines: number;
  bytes: number;
  sentences: number;
  paragraphs: number;
}

function count(text: string): Counts {
  const charsAll = [...text].length;
  const charsNoWhitespace = [...text.replace(/\s+/g, "")].length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text === "" ? 0 : text.split("\n").length;
  const bytes = Buffer.byteLength(text, "utf8");
  const sentences = text.trim() ? (text.match(/[^.!?\n]+[.!?]+/g) ?? []).length : 0;
  const paragraphs = text.trim() ? text.split(/\n\s*\n+/).filter((p) => p.trim()).length : 0;
  return { words, charsAll, charsNoWhitespace, lines, bytes, sentences, paragraphs };
}

function CountText(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");

  const counts = useMemo(() => count(text), [text]);

  function onDone() {
    closeWidget(`${counts.words} words, ${counts.charsAll} characters, ${counts.lines} lines.`);
  }

  const lines = [
    "| | |",
    "|---|---|",
    `| **Words** | ${counts.words} |`,
    `| **Characters** | ${counts.charsAll} |`,
    `| **Characters (no whitespace)** | ${counts.charsNoWhitespace} |`,
    `| **Lines** | ${counts.lines} |`,
    `| **Bytes (UTF-8)** | ${counts.bytes} |`,
    `| **Sentences** | ${counts.sentences} |`,
    `| **Paragraphs** | ${counts.paragraphs} |`,
  ];

  return (
    <Form
      header={<CardHeader title="Text Counter" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel>
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const CountTextWidget = defineWidget({
  name: "count-text",
  description:
    "Count words, characters (with/without whitespace), lines, UTF-8 bytes, sentences, and paragraphs in text.",
  schema,
  component: CountText,
});

export default CountTextWidget;
