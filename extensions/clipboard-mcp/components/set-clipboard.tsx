import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { setClipboard } from "../helpers/pasteboard.js";

const schema = z.object({
  value: z.string().optional().describe("The text to place on the clipboard."),
});

type Props = z.infer<typeof schema>;

function SetClipboard(props: Props) {
  const closeWidget = useCloseWidget();
  const [value, setValue] = useState(props.value ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!value) return;
    setIsSaving(true);
    setError("");
    try {
      await setClipboard(value);
      closeWidget(`Copied ${value.length} character(s) to the clipboard.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsSaving(false);
    }
  }

  return (
    <Form
      header={<CardHeader title="Set Clipboard" iconBundleId="com.apple.finder" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSaving ? "Copying..." : "Copy"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSaving}
            isDisabled={!value}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="value" label="Text" value={value} onChange={setValue} />
    </Form>
  );
}

const SetClipboardWidget = defineWidget({
  name: "set-clipboard",
  description: "Place text onto the macOS clipboard.",
  schema,
  component: SetClipboard,
});

export default SetClipboardWidget;
