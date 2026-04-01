import { useEffect, useState } from "react";
import { z } from "zod";
import {
  CardHeader,
  Form,
  ActionPanel,
  Action,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import { openMessagesChat } from "../helpers/messages-actions.js";
import { ContactSelector } from "./contact-selector.js";

const schema = z.object({
  chatIdentifier: z
    .string()
    .optional()
    .describe("The chat identifier (phone number or email) to open directly."),
});

type Props = z.infer<typeof schema>;

function OpenMessagesChat(props: Props) {
  const closeWidget = useCloseWidget();
  const [selected, setSelected] = useState(props.chatIdentifier ?? "");
  const [selectedLabel, setSelectedLabel] = useState(props.chatIdentifier ?? "");
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState("");

  // If chatIdentifier was provided, open immediately
  useEffect(() => {
    if (!props.chatIdentifier) return;
    setIsOpening(true);
    openMessagesChat(props.chatIdentifier)
      .then(() => closeWidget(`Opened Messages chat with ${props.chatIdentifier}`))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to open Messages");
        setIsOpening(false);
      });
  }, []);

  const header = <CardHeader title="Open Messages" iconBundleId="com.apple.MobileSMS" />;

  // While auto-opening
  if (props.chatIdentifier) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Cancel" onAction={() => closeWidget("Cancelled")} style="secondary" />
          </ActionPanel>
        }
      >
        {error ? <Paper markdown={`**Error:** ${error}`} /> : <Paper markdown="_Opening Messages…_" />}
      </Form>
    );
  }

  // Manual contact picker
  async function onOpen() {
    setIsOpening(true);
    try {
      await openMessagesChat(selected || undefined);
      closeWidget(selected ? `Opened Messages chat with ${selectedLabel} (${selected})` : "Opened Messages app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open Messages");
      setIsOpening(false);
    }
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action
            title={isOpening ? "Opening…" : "Open"}
            onAction={onOpen}
            style="primary"
            isLoading={isOpening}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <ContactSelector
        value={selected}
        onChange={setSelected}
        onSelect={(v, label) => { setSelected(v); setSelectedLabel(label); }}
        label="Contact"
      />
    </Form>
  );
}

const OpenMessagesChatWidget = defineWidget({
  name: "open-messages-chat",
  description: "Open the Messages app or jump directly to a specific conversation",
  schema,
  component: OpenMessagesChat,
});

export default OpenMessagesChatWidget;