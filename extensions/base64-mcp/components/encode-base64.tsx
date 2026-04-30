import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().optional().describe("The text to encode."),
  urlSafe: z.boolean().optional().describe("Use URL-safe base64 (base64url). Defaults to false."),
});

type Props = z.infer<typeof schema>;

function encode(text: string, urlSafe: boolean): string {
  return Buffer.from(text, "utf8").toString(urlSafe ? "base64url" : "base64");
}

function EncodeBase64(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [urlSafe, setUrlSafe] = useState(props.urlSafe ?? false);

  const encoded = text ? encode(text, urlSafe) : "";

  function onDone() {
    if (encoded) closeWidget(`Encoded ${text.length} character(s) to ${encoded.length} base64 character(s).`);
    else closeWidget("Nothing encoded.");
  }

  return (
    <Form
      header={<CardHeader title="Encode Base64" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {encoded && <Action.CopyToClipboard title="Copy" content={encoded} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.Checkbox
        name="urlSafe"
        label="URL-safe (base64url)"
        checked={urlSafe}
        onChange={setUrlSafe}
        variant="switch"
      />
      {encoded && <Paper markdown={"```\n" + encoded + "\n```"} />}
    </Form>
  );
}

const EncodeBase64Widget = defineWidget({
  name: "encode-base64",
  description: "Encode text as base64 (or base64url).",
  schema,
  component: EncodeBase64,
});

export default EncodeBase64Widget;
