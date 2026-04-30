import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import he from "he";

const schema = z.object({
  text: z.string().optional().describe("The text to encode."),
  encodeAll: z.boolean().optional().describe("Encode every non-ASCII char as a numeric entity. Defaults to false (entity-aware)."),
  numeric: z.boolean().optional().describe("Use numeric entities (&#NNN;) instead of named ones (&amp;, &lt;). Defaults to false."),
});

type Props = z.infer<typeof schema>;

function EncodeHtmlEntities(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [encodeAll, setEncodeAll] = useState(props.encodeAll ?? false);
  const [numeric, setNumeric] = useState(props.numeric ?? false);

  const encoded = useMemo(() => {
    if (!text) return "";
    if (encodeAll) {
      return he.encode(text, { useNamedReferences: !numeric, encodeEverything: true });
    }
    return he.encode(text, { useNamedReferences: !numeric });
  }, [text, encodeAll, numeric]);

  function onDone() {
    if (encoded) closeWidget(`Encoded ${text.length} character(s).`);
    else closeWidget("Nothing encoded.");
  }

  return (
    <Form
      header={<CardHeader title="Encode HTML Entities" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {encoded && <Action.CopyToClipboard title="Copy" content={encoded} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.Checkbox
        name="encodeAll"
        label="Encode every non-ASCII char"
        checked={encodeAll}
        onChange={setEncodeAll}
        variant="switch"
      />
      <Form.Checkbox name="numeric" label="Numeric entities (&#NNN;)" checked={numeric} onChange={setNumeric} variant="switch" />
      {encoded && <Paper markdown={"```\n" + encoded + "\n```"} />}
    </Form>
  );
}

const EncodeHtmlEntitiesWidget = defineWidget({
  name: "encode-html-entities",
  description:
    "Encode text as HTML entities via the `he` library. Default mode encodes only the unsafe HTML chars (& < > \" '); 'encode every non-ASCII' encodes every non-ASCII codepoint. Toggle 'numeric' to emit `&#NN;` instead of named entities.",
  schema,
  component: EncodeHtmlEntities,
});

export default EncodeHtmlEntitiesWidget;
