import { useState } from "react";
import {
  Action,
  ActionPanel,
  defineWidget,
  Form,
  Paper,
  CardHeader,
  useCloseWidget,
  runScript,
  Divider,
} from "@eney/api";
import { z } from "zod";
import markdownit from "markdown-it";
import sanitizeHtml from "sanitize-html";

import { useNotes } from "../helpers/use-notes.js";

const props = z.object({
  folder: z.string().optional().describe("The folder to create the note in. If not provided, uses the default folder."),
  content: z.string().optional().describe("The initial content for the new note."),
});

type Props = z.infer<typeof props>;

function escapeDoubleQuotes(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const renderAndCleanContent = (content: string) => {
  const md = markdownit({ breaks: true });
  const rendered = md.render(content);
  return sanitizeHtml(rendered);
};

function CreateNote(props: Props) {
  const closeWidget = useCloseWidget();
  const { data, isLoading: isLoadingNotes } = useNotes();

  const folders = [...new Set(data.allFolders.map((f) => f.name))].sort();

  const [folder, setFolder] = useState(props.folder ?? folders[0] ?? "Notes");
  const [content, setContent] = useState(props.content ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function createNote(folder: string, content: string): Promise<string> {
    const escapedFolder = escapeDoubleQuotes(folder);

    const [firstLine, ...restLines] = content.split("\n");
    const titleText = firstLine.trim();

    const titleHtml = titleText ? `<h1>${renderAndCleanContent(titleText)}</h1>` : "";
    const remainingHtml = renderAndCleanContent(titleText ? restLines.join("\n").trim() : content);
    const bodyHtml = escapeDoubleQuotes(`${titleHtml}${remainingHtml}`);

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
      await createNote(folder, content);
      closeWidget(`Note created successfully in folder "${folder}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsCreating(false);
    }
  }

  const actions = (
    <ActionPanel>
      <Divider />
      <Action.SubmitForm
        title={isCreating ? "Creating..." : "Create note"}
        onSubmit={onSubmit}
        style="primary"
        isDisabled={!content.trim()}
        isLoading={isCreating}
      />
    </ActionPanel>
  );

  const header = <CardHeader title="Create note" iconBundleId="com.apple.Notes" />;

  if (isLoadingNotes) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Loading notes..." />
      </Form>
    );
  }

  return (
    <Form header={header} actions={actions}>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {folders.length > 1 && (
        <Form.Dropdown name="folder" label="Folder" value={folder} onChange={setFolder}>
          {folders.map((f) => (
            <Form.Dropdown.Item key={f} title={f} value={f} />
          ))}
        </Form.Dropdown>
      )}
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
