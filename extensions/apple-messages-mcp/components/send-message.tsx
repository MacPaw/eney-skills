import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  defineWidget,
  useAppleScript,
  useCloseWidget,
} from "@eney/api";
import { sendMessage } from "../helpers/messages-actions.js";
import { ContactSelector } from "./contact-selector.js";

const schema = z.object({
  recipient: z
    .string()
    .optional()
    .describe("The recipient's phone number, email, or contact name."),
  message: z
    .string()
    .optional()
    .describe("The message text to send."),
});

type Props = z.infer<typeof schema>;

function SendMessage(props: Props) {
  const closeWidget = useCloseWidget();
  const runAppleScript = useAppleScript();
  const [recipient, setRecipient] = useState(props.recipient ?? "");
  const [message, setMessage] = useState(props.message ?? "");
  const [isSending, setIsSending] = useState(false);

  const canSend = recipient.trim().length > 0 && message.trim().length > 0;

  async function onSubmit() {
    if (!canSend) return;
    setIsSending(true);
    try {
      await sendMessage(runAppleScript, recipient.trim(), message.trim());
      closeWidget(`🚀 Message sent to ${recipient}`);
    } catch (error) {
      closeWidget(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Form
      header={<CardHeader title="Send Message" iconBundleId="com.apple.MobileSMS" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSending ? "Sending..." : "Send Message"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSending}
            isDisabled={!canSend}
          />
        </ActionPanel>
      }
    >
      <ContactSelector value={recipient} onChange={setRecipient} initialQuery={props.recipient} />
      <Form.TextField
        name="message"
        label="Message"
        value={message}
        onChange={setMessage}
      />
    </Form>
  );
}

const SendMessageWidget = defineWidget({
  name: "send-message",
  description: "Send an iMessage or SMS to a contact after reviewing the draft",
  schema,
  component: SendMessage,
});

export default SendMessageWidget;
