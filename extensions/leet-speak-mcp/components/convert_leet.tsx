import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { toLeet, fromLeet, type Level } from "../helpers/leet.js";

const schema = z.object({
  text: z.string().describe("Text to convert."),
  level: z
    .enum(["basic", "intermediate", "advanced"])
    .optional()
    .describe("Leet intensity. Basic only swaps a/e/i/o/s/t; advanced uses ASCII glyphs like |2 for R."),
  decode: z
    .boolean()
    .optional()
    .describe("If true, decode common leet substitutions back to plain text."),
});

type Props = z.infer<typeof schema>;

function ConvertLeet(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text);
  const [level, setLevel] = useState<Level>((props.level ?? "intermediate") as Level);
  const [decode, setDecode] = useState<boolean>(props.decode ?? false);

  const output = decode ? fromLeet(text) : toLeet(text, level);

  function onApply() {
    /* state is reactive */
  }

  function onSetLevel(l: Level) {
    setLevel(l);
    setDecode(false);
  }

  function onToggleDecode() {
    setDecode((d) => !d);
  }

  function onSwap() {
    setText(output);
  }

  function onDone() {
    closeWidget(output);
  }

  const markdown = output
    ? [
        `### Output (${decode ? "decoded" : `${level} leet`})`,
        "",
        "```",
        output,
        "```",
      ].join("\n")
    : "_Enter text to convert._";

  return (
    <Form
      header={<CardHeader title="Leet Speak" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Apply" onSubmit={onApply} style="primary" />
          <Action title="Basic" onAction={() => onSetLevel("basic")} style="secondary" />
          <Action title="Intermediate" onAction={() => onSetLevel("intermediate")} style="secondary" />
          <Action title="Advanced" onAction={() => onSetLevel("advanced")} style="secondary" />
          <Action
            title={decode ? "Encode" : "Decode"}
            onAction={onToggleDecode}
            style="secondary"
          />
          <Action title="Swap input/output" onAction={onSwap} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
    </Form>
  );
}

const LeetSpeakWidget = defineWidget({
  name: "convert_leet",
  description:
    "Convert text to (or from) leet speak (1337). Three intensity levels — basic (a→4, e→3, i→1, o→0, s→5, t→7), intermediate (adds b→8, g→9, l→1, z→2), advanced (full ASCII-glyph replacement). Decode mode best-effort reverses the basic numeric substitutions.",
  schema,
  component: ConvertLeet,
});

export default LeetSpeakWidget;
