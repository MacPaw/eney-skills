import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";

const schema = z.object({
  timestamp: z
    .string()
    .optional()
    .describe("Unix timestamp in seconds or milliseconds."),
});

type Props = z.infer<typeof schema>;

function ConvertTimestamp(props: Props) {
  const closeWidget = useCloseWidget();
  const [timestamp, setTimestamp] = useState(props.timestamp ?? "");
  const [result, setResult] = useState("");

  function convert(input: string) {
    const num = Number(input);
    if (isNaN(num) || input.trim() === "") {
      setResult("Invalid timestamp");
      return;
    }

    // Auto-detect seconds vs milliseconds (seconds if < 1e12)
    const ms = num < 1e12 ? num * 1000 : num;
    const date = new Date(ms);
    setResult(date.toISOString());
  }

  function onSubmit() {
    convert(timestamp);
  }

  function onNow() {
    const now = Math.floor(Date.now() / 1000).toString();
    setTimestamp(now);
    convert(now);
  }

  function onDone() {
    closeWidget(result || "No conversion performed");
  }

  const actions = (
    <ActionPanel layout="row">
      <Action.SubmitForm title="Convert" onSubmit={onSubmit} style="primary" />
      <Action title="Now" onAction={onNow} style="secondary" />
      <Action.CopyToClipboard
        content={result}
        title="Copy"
        isDisabled={!result || result === "Invalid timestamp"}
      />
    </ActionPanel>
  );

  return (
    <Form actions={actions}>
      <Form.TextField
        name="timestamp"
        label="Unix Timestamp"
        value={timestamp}
        onChange={setTimestamp}
      />
      {result && <Form.TextField name="result" label="ISO Date" value={result} onChange={() => {}} isCopyable />}
    </Form>
  );
}

const ConvertTimestampWidget = defineWidget({
  name: "convert-timestamp",
  description:
    "Converts Unix timestamps to ISO dates with a Now button for current time",
  schema,
  component: ConvertTimestamp,
});

export default ConvertTimestampWidget;
