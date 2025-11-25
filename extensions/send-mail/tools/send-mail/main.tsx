import { useState } from "react";
import { Action, ActionPanel, Form, Paper } from "@macpaw/eney-api";
import { spawn } from "node:child_process";
import { z } from "zod";

const props = z.object({
	recipient: z.string().optional().describe("Email recipient address"),
	subject: z.string().optional().describe("Email subject"),
	body: z.string().optional().describe("Email body text"),
	attachments: z.array(z.string()).optional().describe("Array of file paths to attach"),
});

type Props = z.infer<typeof props>;

function escapeAppleScript(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function sendMail(
	recipient: string,
	subject: string,
	body: string,
	attachments: string[]
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
				reject(new Error(stderr.trim() || `osascript exited with code ${code}`));
				return;
			}
			resolve("Email sent successfully");
		});
	});
}

export default function Extension(props: Props) {
	const [recipient, setRecipient] = useState(props.recipient ?? "");
	const [subject, setSubject] = useState(props.subject ?? "");
	const [body, setBody] = useState(props.body ?? "");
	const [attachments, setAttachments] = useState<string[]>(props.attachments ?? []);
	const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
	const [isSending, setIsSending] = useState(false);

	async function onSubmit() {
		setIsSending(true);
		setStatus(null);

		try {
			const message = await sendMail(recipient, subject, body, attachments);
			setStatus({ type: "success", message });
		} catch (error) {
			setStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Failed to send email",
			});
		} finally {
			setIsSending(false);
		}
	}

	const successActions = (
		<ActionPanel>
			<Action.Finalize title="Done" />
		</ActionPanel>
	);

	if (status?.type && status.type === 'success') {
		return (
			<Form actions={successActions}>
				<Paper markdown={`✅ Message sent successfully to **${recipient}** with subject **${subject}**`} />
			</Form>
		);
	}

	const actions = (
		<ActionPanel>
			<Action.SubmitForm
				title={isSending ? "Sending..." : "Send Email"}
				onSubmit={onSubmit}
				style="primary"
				isDisabled={!recipient || !subject || !body}
				isLoading={isSending}
			/>
		</ActionPanel>
	);

	return (
		<Form actions={actions}>
			{status?.type && status.type === 'error' && (
				<Paper
					markdown={`❌ ${status.message}`}
				/>
			)}
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
