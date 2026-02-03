import { useEffect, useState } from "react";
import { Action, ActionPanel, Form, Paper, setupTool } from "@macpaw/eney-api";
import { z } from "zod";
import markdownit from "markdown-it";
import sanitizeHtml from "sanitize-html";

import { runScript } from "../../helpers/run-script.js";
import { useNotes } from "../../helpers/use-notes.js";

const props = z.object({
  noteName: z
    .string()
    .optional()
    .describe(
      "The name of the note to append to. If not provided, appends to the first note.",
    ),
  content: z
    .string()
    .optional()
    .describe("The text content to append to the note."),
});

type Props = z.infer<typeof props>;

const NEW_NOTE_VALUE = "__new_note__";

function escapeDoubleQuotes(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function appendToNote(
  noteName: string,
  content: string,
): Promise<string> {
  const md = markdownit({
    breaks: true,
  });
  const htmlContent = md.render(content);
  const sanitizedHtml = sanitizeHtml(htmlContent);
  const escapedContent = escapeDoubleQuotes(sanitizedHtml);

  if (noteName === NEW_NOTE_VALUE) {
    return runScript(`
			tell application "Notes"
				set newNote to make new note
				set body of newNote to "${escapedContent}"
			end tell
		`);
  }

  return runScript(`
		tell application "Notes"
			set targetNote to first note whose name is "${escapeDoubleQuotes(noteName)}"
			set body of targetNote to (body of targetNote) & "${escapedContent}"
		end tell
	`);
}

export default function AppendToNote(props: Props) {
  const { data: notes, isLoading: isLoadingNotes } = useNotes();

  const [noteName, setNoteName] = useState(props.noteName ?? NEW_NOTE_VALUE);
  const [content, setContent] = useState(props.content ?? "");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isAppending, setIsAppending] = useState(false);

  useEffect(() => {
    if (
      notes.allNotes.length !== 0 &&
      props.noteName &&
      !notes.allNotes.find((n) => n.title === props.noteName)
    ) {
      setNoteName(NEW_NOTE_VALUE);
    }
  }, [notes.allNotes.length, isLoadingNotes, props.noteName]);

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
        message:
          error instanceof Error ? error.message : "Failed to append to note",
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
    const noteDisplay = noteName ? `"${noteName}"` : "the new note";
    return (
      <Form actions={successActions}>
        <Paper
          markdown={`Content appended successfully to ${noteDisplay}`}
          $context={true}
        />
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

  if (isLoadingNotes) {
    return (
      <Form actions={actions}>
        <Paper markdown={props.noteName} />
        <Paper markdown="Loading notes..." />
      </Form>
    );
  }

  return (
    <Form actions={actions}>
      {status?.type === "error" && <Paper markdown={`❌ ${status.message}`} />}
      <Form.Dropdown name="noteName" value={noteName} onChange={setNoteName}>
        <Form.Dropdown.Item
          key={NEW_NOTE_VALUE}
          title="New Note"
          value={NEW_NOTE_VALUE}
        />
        {notes.allNotes
          ?.slice()
          .sort((a, b) => {
            if (a.title === noteName) return -1;
            if (b.title === noteName) return 1;
            return 0;
          })
          .map((note) => (
            <Form.Dropdown.Item
              key={note.id}
              title={note.title}
              value={note.title}
            />
          ))}
      </Form.Dropdown>
      <Form.RichTextEditor value={content} onChange={setContent} />
    </Form>
  );
}

setupTool(AppendToNote);
