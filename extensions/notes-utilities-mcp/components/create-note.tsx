import { useState } from "react";
import { Action, ActionPanel, defineWidget, Form, Paper, CardHeader, useCloseWidget, useAppleScript } from "@eney/api";
import { z } from "zod";
import markdownit from "markdown-it";
import sanitizeHtml from "sanitize-html";

import { useNotes } from "../helpers/use-notes.js";

const props = z.object({
  folder: z.string().optional().describe("The folder to create the note in. If not provided, uses the default folder."),
  name: z.string().optional().describe("The name/title for the new note."),
  content: z.string().optional().describe("The initial content for the new note."),
});

type Props = z.infer<typeof props>;

function escapeDoubleQuotes(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function CreateNote(props: Props) {
  const runScript = useAppleScript();
  const closeWidget = useCloseWidget();
  const { data: notes, isLoading: isLoadingNotes } = useNotes();

  const folders = [...new Set(notes.allNotes.map((n) => n.folder))].sort();

  const [folder, setFolder] = useState(props.folder ?? folders[0] ?? "Notes");
  const [name, setName] = useState(props.name ?? "");
  const [content, setContent] = useState(props.content ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function createNote(folder: string, name: string, content: string): Promise<string> {
    const md = markdownit({ breaks: true });
    const htmlContent = md.render(content);
    const sanitizedHtml = sanitizeHtml(htmlContent);
    const escapedFolder = escapeDoubleQuotes(folder);

    const nameHtml = name.trim() ? `<h1>${escapeDoubleQuotes(sanitizeHtml(name))}</h1>` : "";
    const bodyHtml = escapeDoubleQuotes(`${nameHtml}${sanitizedHtml}`);

    return runScript(`
    tell application "Notes"
      set targetFolder to first folder whose name is "${escapedFolder}"
      make new note at targetFolder with properties {body:"${bodyHtml}"}
    end tell
  `);
  }

  async function onSubmit() {
    if (!content.trim()) return;

    setIsCreating(true);
    setError("");

    try {
      await createNote(folder, name, content);
      closeWidget(`Note created successfully in folder "${folder}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsCreating(false);
    }
  }

  const actions = (
    <ActionPanel>
      <Action.SubmitForm
        title={isCreating ? "Creating..." : "Create Note"}
        onSubmit={onSubmit}
        style="primary"
        isDisabled={!content.trim()}
        isLoading={isCreating}
      />
    </ActionPanel>
  );

  const header = <CardHeader title="Create Note" iconBundleId="com.apple.Notes" />;

  if (isLoadingNotes) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Loading folders..." />
      </Form>
    );
  }

  return (
    <Form header={header} actions={actions}>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="folder" label="Folder" value={folder} onChange={setFolder}>
        {folders.map((f) => (
          <Form.Dropdown.Item key={f} title={f} value={f} />
        ))}
      </Form.Dropdown>
      <Form.TextField name="name" label="Note Name" value={name} onChange={setName} />
      <Form.RichTextEditor value={content} onChange={setContent} isInitiallyFocused />
    </Form>
  );
}

const CreateNoteWidget = defineWidget({
  name: "create-note",
  description: "Create a new note in Apple Notes",
  schema: props,
  component: CreateNote,
});

export default CreateNoteWidget;
