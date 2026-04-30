import { useState } from "react";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { expandPath, openPath } from "../helpers/paths.js";

const schema = z.object({
  path: z.string().optional().describe("Absolute or ~-prefixed path to open in Finder."),
  reveal: z
    .boolean()
    .optional()
    .describe("If true, reveal the path in its parent folder (highlights it). If false, open the path directly."),
});

type Props = z.infer<typeof schema>;

function OpenInFinder(props: Props) {
  const closeWidget = useCloseWidget();
  const [path, setPath] = useState(props.path ?? "");
  const [reveal, setReveal] = useState(props.reveal ?? false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!path.trim()) return;
    setIsOpening(true);
    setError("");
    try {
      const expanded = expandPath(path);
      try {
        await fs.access(expanded);
      } catch {
        setError(`Path does not exist: ${expanded}`);
        setIsOpening(false);
        return;
      }
      await openPath(expanded, reveal);
      closeWidget(reveal ? `Revealed ${expanded} in Finder.` : `Opened ${expanded} in Finder.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsOpening(false);
    }
  }

  return (
    <Form
      header={<CardHeader title="Open in Finder" iconBundleId="com.apple.finder" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isOpening ? "Opening..." : reveal ? "Reveal" : "Open"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isOpening}
            isDisabled={!path.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="path" label="Path" value={path} onChange={setPath} />
      <Form.Checkbox
        name="reveal"
        label="Reveal in parent folder"
        checked={reveal}
        onChange={setReveal}
        variant="switch"
      />
    </Form>
  );
}

const OpenInFinderWidget = defineWidget({
  name: "open-in-finder",
  description:
    "Open a folder in Finder, or reveal a file with its parent folder highlighted. Path supports ~ expansion.",
  schema,
  component: OpenInFinder,
});

export default OpenInFinderWidget;
