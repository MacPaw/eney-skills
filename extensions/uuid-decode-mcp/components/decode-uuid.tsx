import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { decodeUuid } from "../helpers/uuid.js";

const schema = z.object({
  uuid: z.string().optional().describe("The UUID to decode (canonical 8-4-4-4-12 form, optionally wrapped in {} or urn:uuid:)."),
});

type Props = z.infer<typeof schema>;

function DecodeUuid(props: Props) {
  const closeWidget = useCloseWidget();
  const [uuid, setUuid] = useState(props.uuid ?? "");

  const result = useMemo(() => (uuid.trim() ? decodeUuid(uuid) : null), [uuid]);

  function onDone() {
    if (!result) closeWidget("No UUID decoded.");
    else if ("error" in result) closeWidget(`Invalid: ${result.error}`);
    else closeWidget(`${result.versionLabel} — ${result.canonical}`);
  }

  return (
    <Form
      header={<CardHeader title="UUID Decoder" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {result && !("error" in result) && (
            <Action.CopyToClipboard title="Copy canonical" content={result.canonical} />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="uuid" label="UUID" value={uuid} onChange={setUuid} />
      {result && "error" in result && <Paper markdown={`**Invalid:** ${result.error}`} />}
      {result && !("error" in result) && (
        <Paper
          markdown={[
            `### \`${result.canonical}\``,
            "",
            "| | |",
            "|---|---|",
            `| **Version** | ${result.versionLabel} |`,
            `| **Variant** | ${result.variant} |`,
            result.timestamp
              ? `| **Timestamp** | \`${result.timestamp.toISOString()}\` |`
              : `| **Timestamp** | ${result.timestampNote} |`,
            result.timestamp ? `| **Timestamp note** | ${result.timestampNote} |` : "",
          ]
            .filter(Boolean)
            .join("\n")}
        />
      )}
    </Form>
  );
}

const DecodeUuidWidget = defineWidget({
  name: "decode-uuid",
  description:
    "Decode a UUID's version (v1-v8), variant, and — for time-based versions (v1, v6, v7) — the embedded timestamp. Accepts canonical 8-4-4-4-12 form, optionally wrapped in `{}` or `urn:uuid:`.",
  schema,
  component: DecodeUuid,
});

export default DecodeUuidWidget;
