import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().optional().describe("The text to encode."),
  componentMode: z
    .boolean()
    .optional()
    .describe(
      "If true (default), uses encodeURIComponent (encodes ?, &, =, /, etc.). If false, uses encodeURI which preserves URL structure.",
    ),
});

type Props = z.infer<typeof schema>;

function encode(text: string, componentMode: boolean): string {
  return componentMode ? encodeURIComponent(text) : encodeURI(text);
}

function EncodeUrl(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [componentMode, setComponentMode] = useState(props.componentMode ?? true);

  const encoded = text ? encode(text, componentMode) : "";

  function onDone() {
    if (encoded) closeWidget(`Encoded ${text.length} character(s).`);
    else closeWidget("Nothing encoded.");
  }

  return (
    <Form
      header={<CardHeader title="URL Encode" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {encoded && <Action.CopyToClipboard title="Copy" content={encoded} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.Checkbox
        name="componentMode"
        label="Component mode (encodeURIComponent)"
        checked={componentMode}
        onChange={setComponentMode}
        variant="switch"
      />
      {encoded && <Paper markdown={"```\n" + encoded + "\n```"} />}
    </Form>
  );
}

const EncodeUrlWidget = defineWidget({
  name: "encode-url",
  description:
    "Percent-encode text for use in URLs. Component mode (default) escapes ?, &, =, /, etc. — suitable for query parameter values. Disable component mode to use encodeURI, which preserves URL structure.",
  schema,
  component: EncodeUrl,
});

export default EncodeUrlWidget;
