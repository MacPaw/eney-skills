import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import he from "he";

const schema = z.object({
  encoded: z.string().optional().describe("Text containing HTML entities to decode."),
});

type Props = z.infer<typeof schema>;

function DecodeHtmlEntities(props: Props) {
  const closeWidget = useCloseWidget();
  const [encoded, setEncoded] = useState(props.encoded ?? "");

  const decoded = useMemo(() => (encoded ? he.decode(encoded) : ""), [encoded]);

  function onDone() {
    if (decoded) closeWidget(`Decoded to ${decoded.length} character(s).`);
    else closeWidget("Nothing decoded.");
  }

  return (
    <Form
      header={<CardHeader title="Decode HTML Entities" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {decoded && <Action.CopyToClipboard title="Copy" content={decoded} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="encoded" label="Encoded" value={encoded} onChange={setEncoded} />
      {decoded && <Paper markdown={"```\n" + decoded + "\n```"} />}
    </Form>
  );
}

const DecodeHtmlEntitiesWidget = defineWidget({
  name: "decode-html-entities",
  description: "Decode HTML entities (named, decimal, and hex) in a string back to their underlying characters.",
  schema,
  component: DecodeHtmlEntities,
});

export default DecodeHtmlEntitiesWidget;
