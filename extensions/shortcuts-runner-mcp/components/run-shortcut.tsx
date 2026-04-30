import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { listShortcuts, runShortcut } from "../helpers/shortcuts.js";

const schema = z.object({
  shortcut: z.string().optional().describe("The exact name of the shortcut to run."),
  input: z.string().optional().describe("Optional input text passed to the shortcut on stdin."),
});

type Props = z.infer<typeof schema>;

function RunShortcut(props: Props) {
  const closeWidget = useCloseWidget();
  const [shortcut, setShortcut] = useState(props.shortcut ?? "");
  const [input, setInput] = useState(props.input ?? "");
  const [shortcuts, setShortcuts] = useState<string[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listShortcuts()
      .then((available) => {
        setShortcuts(available);
        if (!shortcut && available.length) setShortcut(available[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingList(false));
  }, []);

  async function onSubmit() {
    if (!shortcut) return;
    setIsRunning(true);
    setError("");
    setOutput(null);
    try {
      const result = await runShortcut(shortcut, input || undefined);
      if (!result.ok) {
        setError(result.error || "Shortcut failed.");
      }
      setOutput(result.output);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }

  function onDone() {
    if (output !== null) {
      const trimmed = output.trim();
      closeWidget(trimmed ? `Shortcut output: ${trimmed.slice(0, 200)}` : `Ran "${shortcut}".`);
    } else {
      closeWidget("Run cancelled.");
    }
  }

  const header = <CardHeader title="Run Shortcut" iconBundleId="com.apple.shortcuts" />;

  if (isLoadingList) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown="Loading shortcuts..." />
      </Form>
    );
  }

  if (!shortcuts.length && !error) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown="_No shortcuts found in this user's Shortcuts library._" />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isRunning ? "Running..." : "Run"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isRunning}
            isDisabled={!shortcut}
          />
          {output && <Action.CopyToClipboard title="Copy output" content={output} />}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="shortcut" label="Shortcut" value={shortcut} onChange={setShortcut} searchable>
        {shortcuts.map((s) => (
          <Form.Dropdown.Item key={s} title={s} value={s} />
        ))}
      </Form.Dropdown>
      <Form.TextField name="input" label="Input (optional)" value={input} onChange={setInput} />
      {output !== null && (
        <Paper markdown={output.trim() ? "```\n" + output + "\n```" : "_Shortcut produced no output._"} />
      )}
    </Form>
  );
}

const RunShortcutWidget = defineWidget({
  name: "run-shortcut",
  description: "Run a macOS Shortcut from the user's library, with optional input text passed on stdin.",
  schema,
  component: RunShortcut,
});

export default RunShortcutWidget;
