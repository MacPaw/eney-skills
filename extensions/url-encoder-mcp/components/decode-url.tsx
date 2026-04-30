import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  encoded: z.string().optional().describe("The percent-encoded text to decode."),
});

type Props = z.infer<typeof schema>;

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

function DecodeUrl(props: Props) {
  const closeWidget = useCloseWidget();
  const [encoded, setEncoded] = useState(props.encoded ?? "");

  const decoded = encoded ? decode(encoded) : "";

  function onDone() {
    if (decoded === null) closeWidget("Decode failed — invalid percent-encoding.");
    else if (decoded) closeWidget(`Decoded to ${decoded.length} character(s).`);
    else closeWidget("Nothing decoded.");
  }

  return (
    <Form
      header={<CardHeader title="URL Decode" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {decoded && <Action.CopyToClipboard title="Copy" content={decoded} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="encoded" label="Encoded" value={encoded} onChange={setEncoded} />
      {decoded === null && <Paper markdown="_Invalid percent-encoding._" />}
      {decoded && <Paper markdown={"```\n" + decoded + "\n```"} />}
    </Form>
  );
}

const DecodeUrlWidget = defineWidget({
  name: "decode-url",
  description: "Decode a percent-encoded URL string back to its original text.",
  schema,
  component: DecodeUrl,
});

export default DecodeUrlWidget;
