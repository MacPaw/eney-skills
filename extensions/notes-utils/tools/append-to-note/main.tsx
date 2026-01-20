import { useState } from "react";
import { Action, ActionPanel, Form, Paper, setupTool } from "@macpaw/eney-api";
import { spawn } from "node:child_process";
import { z } from "zod";

const props = z.object({
	noteName: z.string()
		.optional()
		.describe("The name of the note to append to. If not provided, appends to the first note."),
	content: z.string()
		.optional()
		.describe("The text content to append to the note."),
});

type Props = z.infer<typeof props>;

function escapeAppleScript(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function appendToNote(noteName: string, content: string): Promise<string> {
	const script = noteName
		? `
tell application "Notes"
	set targetNote to first note whose name is "${escapeAppleScript(noteName)}"
	set body of targetNote to (body of targetNote) & "<br><br>" & "${escapeAppleScript(content)}"
end tell
`
		: `
tell application "Notes"
	set targetNote to first note
	set body of targetNote to (body of targetNote) & "<br><br>" & "${escapeAppleScript(content)}"
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
			resolve("Content appended successfully");
		});
	});
}

export default function AppendToNote(props: Props) {
	const [noteName, setNoteName] = useState(props.noteName ?? "");
	const [content, setContent] = useState(props.content ?? "");
	const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
	const [isAppending, setIsAppending] = useState(false);

	async function onSubmit() {
		if (!content.trim()) return;

		setIsAppending(true);
		setStatus(null);

		try {
			const message = await appendToNote(noteName, content);
			setStatus({ type: "success", message });
		} catch (error) {
			setStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Failed to append to note",
			});
		} finally {
			setIsAppending(false);
		}
	}

	const successActions = (
		<ActionPanel>
			<Action.Finalize title="Done" />
		</ActionPanel>
	);

	if (status?.type === "success") {
		const noteDisplay = noteName ? `"${noteName}"` : "most recent note";
		return (
			<Form actions={successActions}>
				<Paper markdown={`✅ Content appended successfully to ${noteDisplay}`} $context={true} />
			</Form>
		);
	}

	const actions = (
		<ActionPanel>
			<Action.SubmitForm
				title={isAppending ? "Appending..." : "Append to Note"}
				onSubmit={onSubmit}
				style="primary"
				isDisabled={!content.trim()}
				isLoading={isAppending}
			/>
		</ActionPanel>
	);

	return (
		<Form actions={actions}>
			{status?.type === "error" && (
				<Paper markdown={`❌ ${status.message}`} />
			)}
			<Form.TextField
				name="noteName"
				label="Note Name (leave empty for most recent note)"
				value={noteName}
				onChange={setNoteName}
			/>
			<Form.RichTextEditor
				value={content}
				onChange={setContent}
			/>
		</Form>
	);
}

setupTool(AppendToNote);
