import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  encoded: z.string().optional().describe("The base64 (or base64url) string to decode."),
});

type Props = z.infer<typeof schema>;

interface DecodeResult {
  text: string;
  isLikelyBinary: boolean;
}

function decode(encoded: string): DecodeResult | null {
  const trimmed = encoded.trim();
  if (!trimmed) return null;
  try {
    const buffer = Buffer.from(trimmed, /-|_/.test(trimmed) ? "base64url" : "base64");
    if (buffer.length === 0 && trimmed.length > 0) return null;
    const text = buffer.toString("utf8");
    const isLikelyBinary = /�|[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text);
    return { text, isLikelyBinary };
  } catch {
    return null;
  }
}

function DecodeBase64(props: Props) {
  const closeWidget = useCloseWidget();
  const [encoded, setEncoded] = useState(props.encoded ?? "");

  const result = decode(encoded);

  function onDone() {
    if (!result) closeWidget("No output.");
    else if (result.isLikelyBinary) closeWidget("Decoded — output looks like binary data.");
    else closeWidget(`Decoded to ${result.text.length} character(s).`);
  }

  return (
    <Form
      header={<CardHeader title="Decode Base64" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {result && !result.isLikelyBinary && <Action.CopyToClipboard title="Copy" content={result.text} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="encoded" label="Base64" value={encoded} onChange={setEncoded} />
      {!result && encoded.trim() && <Paper markdown="_Invalid base64 input._" />}
      {result?.isLikelyBinary && (
        <Paper markdown={`_Decoded ${Buffer.byteLength(result.text, "utf8")} byte(s); output appears to be binary and is not shown as text._`} />
      )}
      {result && !result.isLikelyBinary && <Paper markdown={"```\n" + result.text + "\n```"} />}
    </Form>
  );
}

const DecodeBase64Widget = defineWidget({
  name: "decode-base64",
  description: "Decode a base64 (or base64url) string to UTF-8 text.",
  schema,
  component: DecodeBase64,
});

export default DecodeBase64Widget;
