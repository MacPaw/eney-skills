import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { createTwoFilesPatch } from "diff";

const schema = z.object({
  before: z.string().optional().describe("The original ('before') text."),
  after: z.string().optional().describe("The modified ('after') text."),
  contextLines: z.number().int().optional().describe("Number of unchanged context lines around each hunk. Defaults to 3."),
});

type Props = z.infer<typeof schema>;

interface Stats {
  added: number;
  removed: number;
}

function makePatch(before: string, after: string, context: number): string {
  if (before === after) return "";
  return createTwoFilesPatch("before.txt", "after.txt", before, after, "", "", { context });
}

function statsFor(patch: string): Stats {
  let added = 0;
  let removed = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+")) added += 1;
    else if (line.startsWith("-")) removed += 1;
  }
  return { added, removed };
}

function DiffText(props: Props) {
  const closeWidget = useCloseWidget();
  const [before, setBefore] = useState(props.before ?? "");
  const [after, setAfter] = useState(props.after ?? "");
  const [contextLines, setContextLines] = useState<number | null>(props.contextLines ?? 3);

  const patch = useMemo(
    () => makePatch(before, after, Math.max(0, Math.min(20, contextLines ?? 3))),
    [before, after, contextLines],
  );

  const stats = useMemo(() => (patch ? statsFor(patch) : { added: 0, removed: 0 }), [patch]);

  function onDone() {
    if (!before && !after) closeWidget("Nothing to diff.");
    else if (before === after) closeWidget("No differences.");
    else closeWidget(`Diff: +${stats.added} −${stats.removed}.`);
  }

  return (
    <Form
      header={<CardHeader title="Diff Text" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {patch && <Action.CopyToClipboard title="Copy patch" content={patch} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="before" label="Before" value={before} onChange={setBefore} />
      <Form.TextField name="after" label="After" value={after} onChange={setAfter} />
      <Form.NumberField
        name="contextLines"
        label="Context lines"
        value={contextLines}
        onChange={setContextLines}
        min={0}
        max={20}
      />
      {!before && !after && <Paper markdown="_Enter both before and after text._" />}
      {(before || after) && before === after && <Paper markdown="_The two inputs are identical._" />}
      {patch && (
        <Paper
          markdown={
            `**+${stats.added}** **−${stats.removed}**\n\n` + "```diff\n" + patch + "\n```"
          }
        />
      )}
    </Form>
  );
}

const DiffTextWidget = defineWidget({
  name: "diff-text",
  description:
    "Show a unified diff between two pieces of text. Configurable context lines (0-20). Reports added/removed line counts and outputs a standard `--- /+++` patch suitable for `patch -p0`.",
  schema,
  component: DiffText,
});

export default DiffTextWidget;
