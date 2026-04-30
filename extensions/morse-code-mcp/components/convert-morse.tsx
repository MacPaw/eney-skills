import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { decodeMorse, encodeMorse } from "../helpers/morse.js";

type Direction = "auto" | "encode" | "decode";

const schema = z.object({
  input: z.string().optional().describe("Text to encode, or Morse code (dots, dashes, spaces) to decode."),
  direction: z.enum(["auto", "encode", "decode"]).optional().describe("Conversion direction. Defaults to auto-detect."),
});

type Props = z.infer<typeof schema>;

function detectDirection(input: string): "encode" | "decode" {
  const trimmed = input.trim();
  if (!trimmed) return "encode";
  return /^[.\-/\s]+$/.test(trimmed) ? "decode" : "encode";
}

function ConvertMorse(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");
  const [direction, setDirection] = useState<Direction>(props.direction ?? "auto");

  const resolvedDirection = direction === "auto" ? detectDirection(input) : direction;

  const result = useMemo(() => {
    if (!input.trim()) return null;
    if (resolvedDirection === "encode") return { mode: "encode" as const, output: encodeMorse(input), unknownTokens: [] as string[] };
    const { text, unknownTokens } = decodeMorse(input);
    return { mode: "decode" as const, output: text, unknownTokens };
  }, [input, resolvedDirection]);

  function onDone() {
    if (!result) closeWidget("Nothing converted.");
    else closeWidget(`${resolvedDirection === "encode" ? "Encoded" : "Decoded"}: ${result.output.slice(0, 80)}`);
  }

  return (
    <Form
      header={<CardHeader title="Morse Code" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {result?.output && <Action.CopyToClipboard title="Copy" content={result.output} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="Input" value={input} onChange={setInput} />
      <Form.Dropdown
        name="direction"
        label="Direction"
        value={direction}
        onChange={(v) => setDirection(v as Direction)}
      >
        <Form.Dropdown.Item title="Auto-detect" value="auto" />
        <Form.Dropdown.Item title="Text → Morse" value="encode" />
        <Form.Dropdown.Item title="Morse → Text" value="decode" />
      </Form.Dropdown>
      {result?.output && <Paper markdown={"```\n" + result.output + "\n```"} />}
      {result && result.unknownTokens.length > 0 && (
        <Paper
          markdown={`_Unrecognised Morse tokens replaced with \`?\`: \`${result.unknownTokens.join(" ")}\`_`}
        />
      )}
    </Form>
  );
}

const ConvertMorseWidget = defineWidget({
  name: "convert-morse",
  description:
    "Convert text to International Morse Code or decode Morse back to text. Auto-detect picks direction based on whether the input contains only `.`, `-`, `/`, and whitespace. Letters/digits/punctuation outside the alphabet are dropped on encode; unrecognised tokens decode as `?`.",
  schema,
  component: ConvertMorse,
});

export default ConvertMorseWidget;
