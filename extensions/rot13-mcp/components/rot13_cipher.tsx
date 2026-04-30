import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { caesar } from "../helpers/cipher.js";

const schema = z.object({
  text: z.string().describe("Text to encode or decode."),
  shift: z
    .number()
    .int()
    .optional()
    .describe("Caesar shift. Defaults to 13 (ROT13). Use any integer; shifts wrap."),
  shiftDigits: z
    .boolean()
    .optional()
    .describe("Also apply the shift modulo 10 to digits 0–9 (ROT5). Defaults to false."),
});

type Props = z.infer<typeof schema>;

function Rot13Cipher(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text);
  const [shift, setShift] = useState<number>(props.shift ?? 13);
  const [shiftDigits, setShiftDigits] = useState<boolean>(props.shiftDigits ?? false);
  const [output, setOutput] = useState<string>(() =>
    caesar(props.text ?? "", {
      shift: props.shift ?? 13,
      shiftDigits: props.shiftDigits ?? false,
    }),
  );

  function recompute(opts?: { shift?: number; shiftDigits?: boolean; text?: string }) {
    const s = opts?.shift ?? shift;
    const sd = opts?.shiftDigits ?? shiftDigits;
    const t = opts?.text ?? text;
    setOutput(caesar(t, { shift: s, shiftDigits: sd }));
  }

  function onApply() {
    recompute();
  }

  function onSetShift(value: number) {
    setShift(value);
    recompute({ shift: value });
  }

  function onToggleDigits() {
    const v = !shiftDigits;
    setShiftDigits(v);
    recompute({ shiftDigits: v });
  }

  function onSwap() {
    // Swap input and output: useful for "decode now" since ROT13 is its own inverse,
    // but for arbitrary shift this lets the user round-trip easily.
    setText(output);
    recompute({ text: output });
  }

  function onDone() {
    closeWidget(output);
  }

  const markdown = output
    ? [
        `### Output (shift ${shift}${shiftDigits ? ", digits ROT5" : ""})`,
        ``,
        `\`\`\``,
        output,
        `\`\`\``,
      ].join("\n")
    : "_Enter text to transform._";

  return (
    <Form
      header={<CardHeader title="ROT13 / Caesar Cipher" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Apply" onSubmit={onApply} style="primary" />
          <Action title="ROT13" onAction={() => onSetShift(13)} style="secondary" />
          <Action title="ROT5" onAction={() => onSetShift(5)} style="secondary" />
          <Action title="ROT47" onAction={() => onSetShift(47)} style="secondary" />
          <Action
            title={shiftDigits ? "Don't shift digits" : "Shift digits too"}
            onAction={onToggleDigits}
            style="secondary"
          />
          <Action title="Swap input/output" onAction={onSwap} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.NumberField
        name="shift"
        label="Shift"
        value={shift}
        onChange={(v) => onSetShift(Number(v) || 0)}
      />
    </Form>
  );
}

const Rot13Widget = defineWidget({
  name: "rot13_cipher",
  description:
    "Encode or decode text using ROT13 — a self-inverse Caesar cipher. Configurable shift (any integer) and optional ROT5 digit shifting. ROT13 is its own inverse: applying it twice returns the original.",
  schema,
  component: Rot13Cipher,
});

export default Rot13Widget;
