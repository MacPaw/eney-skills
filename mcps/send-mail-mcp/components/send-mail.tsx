import { useState, useEffect } from "react";
import {
  Action,
  ActionPanel,
  defineWidget,
  Form,
  Paper,
  useCloseWidget,
} from "@macpaw/eney-api";
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { basename } from "node:path";
import { z } from "zod";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface OversizedFile {
  path: string;
  name: string;
  sizeMB: number;
}

function getOversizedFiles(filePaths: string[]): OversizedFile[] {
  const oversized: OversizedFile[] = [];
  for (const filePath of filePaths) {
    try {
      const stats = statSync(filePath);
      if (stats.size > MAX_FILE_SIZE_BYTES) {
        oversized.push({
          path: filePath,
          name: basename(filePath),
          sizeMB: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
        });
      }
    } catch {
      // File doesn't exist or can't be accessed, skip
    }
  }
  return oversized;
}

const props = z.object({
  recipient: z.string().optional().describe("Email recipient address"),
  subject: z.string().optional().describe("Email subject"),
  body: z.string().optional().describe("Email body text"),
  attachments: z
    .array(z.string())
    .optional()
    .describe("Array of file paths to attach"),
});

type Props = z.infer<typeof props>;

function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function sendMail(
  recipient: string,
  subject: string,
  body: string,
  attachments: string[],
): Promise<string> {
  const attachmentsList = attachments
    .map((path) => `"${escapeAppleScript(path)}"`)
    .join(", ");

  const script = `
tell application "Mail"
	set theMessage to make new outgoing message with properties {subject:"${escapeAppleScript(subject)}", content:"${escapeAppleScript(body)}", visible:false}
	tell theMessage
		make new to recipient at end of to recipients with properties {address:"${escapeAppleScript(recipient)}"}
		${
      attachments.length > 0
        ? `
		set theAttachments to {${attachmentsList}}
		repeat with theAttachment in theAttachments
			set theAttachmentAlias to POSIX file theAttachment
			make new attachment with properties {file name:theAttachmentAlias} at after last paragraph
			delay 1
		end repeat`
        : ""
    }
	end tell
	send theMessage
end tell
`;

  return new Promise((resolve, reject) => {
    const osascript = spawn("osascript", ["-e", script]);
    let stderr = "";

    osascript.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    osascript.on("error", (error) => {
      reject(new Error(`Failed to execute AppleScript: ${error.message}`));
    });

    osascript.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(stderr.trim() || `osascript exited with code ${code}`),
        );
        return;
      }
      resolve("Email sent successfully");
    });
  });
}

export function SendMail(props: Props) {
  const closeWidget = useCloseWidget();
  const [recipient, setRecipient] = useState(props.recipient ?? "");
  const [subject, setSubject] = useState(props.subject ?? "");
  const [body, setBody] = useState(props.body ?? "");
  const [attachments, setAttachments] = useState<string[]>(
    props.attachments ?? [],
  );
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [oversizedFiles, setOversizedFiles] = useState<OversizedFile[]>([]);

  useEffect(() => {
    setOversizedFiles(getOversizedFiles(attachments));
  }, [attachments]);

  async function onSubmit() {
    setIsSending(true);
    setStatus(null);

    try {
      await sendMail(recipient, subject, body, attachments);
      closeWidget(
        `Message sent successfully to **${recipient}** with subject **${subject}**`,
      );
    } catch (error) {
      closeWidget(
        `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const hasOversizedFiles = oversizedFiles.length > 0;

  const actions = (
    <ActionPanel>
      <Action.SubmitForm
        title={isSending ? "Sending..." : "Send Email"}
        onSubmit={onSubmit}
        style="primary"
        isDisabled={!recipient || !subject || hasOversizedFiles}
        isLoading={isSending}
      />
    </ActionPanel>
  );

  return (
    <Form actions={actions}>
      {status?.type && status.type === "error" && (
        <Paper markdown={`❌ ${status.message}`} />
      )}
      {oversizedFiles.map((file) => (
        <Paper
          key={file.path}
          markdown={`❌ File "${file.name}" is too large (${file.sizeMB} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`}
        />
      ))}
      <Form.TextField
        name="recipient"
        label="To"
        value={recipient}
        onChange={setRecipient}
      />
      <Form.TextField
        name="subject"
        label="Subject"
        value={subject}
        onChange={setSubject}
      />
      <Form.TextField
        name="body"
        label="Message"
        value={body}
        onChange={setBody}
      />
      <Form.FilePicker
        name="attachments"
        label="Attachments"
        value={attachments}
        onChange={setAttachments}
        multiple
      />
    </Form>
  );
}

const SendMailWidget = defineWidget({
  name: "send-mail",
  description: "Send emails with attachments",
  schema: props,
  component: SendMail,
});

export default SendMailWidget;
