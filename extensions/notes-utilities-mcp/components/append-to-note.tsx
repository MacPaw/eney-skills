import { useEffect, useState } from "react";
import { Action, ActionPanel, defineWidget, Form, Paper, CardHeader, useCloseWidget, useAppleScript } from "@eney/api";
import { z } from "zod";
import markdownit from "markdown-it";
import sanitizeHtml from "sanitize-html";

import { useNotes } from "../helpers/use-notes.js";

const props = z.object({
  noteName: z
    .string()
    .optional()
    .describe("The name of the note to append to. If not provided, appends to the first note."),
  content: z.string().optional().describe("The text content to append to the note."),
});

type Props = z.infer<typeof props>;

const NEW_NOTE_VALUE = "__new_note__";
const TITLE_MAX_LENGTH = 42;

function escapeDoubleQuotes(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function AppendToNote(props: Props) {
  const closeWidget = useCloseWidget();
  const runScript = useAppleScript();
  const { data: notes, isLoading: isLoadingNotes } = useNotes();

  const [noteName, setNoteName] = useState(props.noteName ?? NEW_NOTE_VALUE);
  const [content, setContent] = useState(props.content ?? "");
  const [isAppending, setIsAppending] = useState(false);

  useEffect(() => {
    if (notes.allNotes.length !== 0 && props.noteName && !notes.allNotes.find((n) => n.title === props.noteName)) {
      setNoteName(NEW_NOTE_VALUE);
    }
  }, [notes.allNotes.length, isLoadingNotes, props.noteName]);

  function formatTitle(title: string): string {
    return title.length > TITLE_MAX_LENGTH ? `${title.slice(0, TITLE_MAX_LENGTH)}...` : title;
  }

  async function appendToNote(noteName: string, content: string): Promise<string> {
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

  async function onSubmit() {
    if (!content.trim()) return;

    setIsAppending(true);

    let finalContext = "";

    try {
      await appendToNote(noteName, content);

      const noteDisplay = noteName === NEW_NOTE_VALUE ? "a new note" : `the note "${noteName}"`;

      finalContext = `Content appended successfully to ${noteDisplay}`;
    } catch (error) {
      finalContext = error instanceof Error ? error.message : "Failed to append to note";
    } finally {
      setIsAppending(false);
      closeWidget(finalContext);
    }
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

  const header = <CardHeader title="Notes" iconBundleId="com.apple.Notes" />;

  if (isLoadingNotes) {
    return (
      <Form actions={actions}>
        <Paper markdown={props.noteName} />
        <Paper markdown="Loading notes..." />
      </Form>
    );
  }

  return (
    <Form actions={actions} header={header}>
      <Form.Dropdown name="noteName" value={noteName} onChange={setNoteName}>
        <Form.Dropdown.Item key={NEW_NOTE_VALUE} title="New Note" value={NEW_NOTE_VALUE} />
        {notes.allNotes
          ?.slice()
          .sort((a, b) => {
            if (a.title === noteName) return -1;
            if (b.title === noteName) return 1;
            return 0;
          })
          .map((note) => (
            <Form.Dropdown.Item key={note.id} title={formatTitle(note.title)} value={note.title} />
          ))}
      </Form.Dropdown>
      <Form.RichTextEditor value={content} onChange={setContent} isInitiallyFocused />
    </Form>
  );
}

const AppendToNoteWidget = defineWidget({
  name: "append-to-note",
  description: "Append content to a note",
  schema: props,
  component: AppendToNote,
});

export default AppendToNoteWidget;
