import { useState } from "react";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { expandPath, openPath } from "../helpers/paths.js";

const schema = z.object({
  parentPath: z
    .string()
    .optional()
    .describe("Parent directory where the new folder will be created. Defaults to ~/Desktop."),
  name: z.string().optional().describe("The name of the new folder."),
});

type Props = z.infer<typeof schema>;

function NewFolder(props: Props) {
  const closeWidget = useCloseWidget();
  const [parentPath, setParentPath] = useState(props.parentPath ?? `${homedir()}/Desktop`);
  const [name, setName] = useState(props.name ?? "");
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    const trimmedName = name.trim();
    const trimmedParent = parentPath.trim();
    if (!trimmedName || !trimmedParent) return;
    if (/[\/]/.test(trimmedName)) {
      setError("Folder name cannot contain '/'.");
      return;
    }
    setIsCreating(true);
    setError("");
    try {
      const expandedParent = expandPath(trimmedParent);
      try {
        const stat = await fs.stat(expandedParent);
        if (!stat.isDirectory()) {
          setError(`Parent is not a directory: ${expandedParent}`);
          setIsCreating(false);
          return;
        }
      } catch {
        setError(`Parent directory does not exist: ${expandedParent}`);
        setIsCreating(false);
        return;
      }
      const target = join(expandedParent, trimmedName);
      await fs.mkdir(target, { recursive: false });
      setCreatedPath(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCreating(false);
    }
  }

  function onDone() {
    if (createdPath) closeWidget(`Created folder ${createdPath}.`);
    else closeWidget("No folder created.");
  }

  async function onReveal() {
    if (!createdPath) return;
    try {
      await openPath(createdPath, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const header = <CardHeader title="New Folder" iconBundleId="com.apple.finder" />;

  if (createdPath) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Open in Finder" onAction={onReveal} style="secondary" />
            <Action.SubmitForm title="Create Another" onSubmit={() => setCreatedPath(null)} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`Created \`${createdPath}\`.`} />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isCreating ? "Creating..." : "Create"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isCreating}
            isDisabled={!name.trim() || !parentPath.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="parentPath" label="Parent" value={parentPath} onChange={setParentPath} />
      <Form.TextField name="name" label="Folder name" value={name} onChange={setName} />
    </Form>
  );
}

const NewFolderWidget = defineWidget({
  name: "new-folder",
  description: "Create a new folder under a chosen parent directory. Parent path supports ~ expansion.",
  schema,
  component: NewFolder,
});

export default NewFolderWidget;
