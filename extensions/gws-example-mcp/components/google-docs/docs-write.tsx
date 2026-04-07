import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Divider,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
  useLogger,
} from "@eney/api";
import { execGws, docsToken } from "../../helpers/gws.js";
import { useDocFiles } from "../../helpers/use-doc-files.js";

const schema = z.object({
  documentId: z.string().optional().describe("ID of the Google Doc to append text to."),
  text: z.string().optional().describe("Text to append to the document."),
});

type Props = z.infer<typeof schema>;

function DocsWrite(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { docs, isLoading: isLoadingDocs, error: docsError } = useDocFiles();
  const [selectedId, setSelectedId] = useState(props.documentId ?? "");
  const [text, setText] = useState(props.text ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedDoc = docs.find((d) => d.id === selectedId);

  async function onSubmit() {
    if (!selectedId || !text) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[docs-write] documentId=${selectedId} textLen=${text.length}`);
      await execGws(
        `docs +write --document ${selectedId} --text ${JSON.stringify(text)}`,
        docsToken(),
        logger
      );
      logger.info(`[docs-write] completed`);
      setResult(`**Text appended successfully**\n\nDocument: **${selectedDoc?.name ?? selectedId}**`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[docs-write] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Append to Document" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Append More" onSubmit={() => setResult("")} style="secondary" />
            <Action title="Done" onAction={() => closeWidget(result)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={result} />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Divider />
          <Action.SubmitForm
            title={isLoading ? "Appending…" : "Append Text"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedId || !text}
          />
        </ActionPanel>
      }
    >
      {docsError && <Paper markdown={`**Error loading documents:** ${docsError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="documentId" label="Document" value={selectedId} onChange={setSelectedId}>
        {isLoadingDocs
          ? [<Form.Dropdown.Item key="loading" title="Loading documents…" value="" />]
          : docs.map((d) => (
              <Form.Dropdown.Item key={d.id} title={d.name} value={d.id} />
            ))}
      </Form.Dropdown>
      <Form.TextField name="text" label="Text to Append" value={text} onChange={setText} />
    </Form>
  );
}

const DocsWriteWidget = defineWidget({
  name: "docs-write",
  description: "Append text to a Google Doc",
  schema,
  component: DocsWrite,
});

export default DocsWriteWidget;
