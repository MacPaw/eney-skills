import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { getClipboard } from "../helpers/pasteboard.js";

const schema = z.object({});

type Props = z.infer<typeof schema>;

const PREVIEW_LIMIT = 4000;

function GetClipboard(_props: Props) {
  const closeWidget = useCloseWidget();
  const [contents, setContents] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getClipboard()
      .then(setContents)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoading(false));
  }, []);

  function onDone() {
    if (contents === null) {
      closeWidget("Clipboard could not be read.");
    } else if (!contents) {
      closeWidget("Clipboard is empty.");
    } else {
      closeWidget(`Clipboard contains ${contents.length} character(s).`);
    }
  }

  const header = <CardHeader title="Clipboard contents" iconBundleId="com.apple.finder" />;

  if (isLoading) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown="Reading clipboard..." />
      </Form>
    );
  }

  const isEmpty = contents === null || contents === "";
  const truncated = !isEmpty && contents!.length > PREVIEW_LIMIT;
  const preview = isEmpty
    ? "_Clipboard is empty._"
    : truncated
      ? contents!.slice(0, PREVIEW_LIMIT) + "\n\n_…truncated…_"
      : contents!;

  return (
    <Form
      header={header}
      actions={
        <ActionPanel layout="row">
          {!isEmpty && <Action.CopyToClipboard title="Copy" content={contents!} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={"```\n" + preview + "\n```"} />
    </Form>
  );
}

const GetClipboardWidget = defineWidget({
  name: "get-clipboard",
  description: "Show the current text contents of the macOS clipboard.",
  schema,
  component: GetClipboard,
});

export default GetClipboardWidget;
