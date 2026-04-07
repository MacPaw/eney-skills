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
  documentId: z.string().optional().describe("ID of the Google Doc to update."),
  requests: z.string().optional().describe("JSON array of batchUpdate requests."),
});

type Props = z.infer<typeof schema>;

const EXAMPLES = [
  {
    label: "Insert text at end",
    value: JSON.stringify([
      { insertText: { location: { index: 1 }, text: "Hello, world!\n" } },
    ], null, 2),
  },
  {
    label: "Delete all content",
    value: JSON.stringify([
      { deleteContentRange: { range: { startIndex: 1, endIndex: 2 } } },
    ], null, 2),
  },
];

function DocsBatchUpdate(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { docs, isLoading: isLoadingDocs, error: docsError } = useDocFiles();
  const [selectedId, setSelectedId] = useState(props.documentId ?? "");
  const [requests, setRequests] = useState(props.requests ?? EXAMPLES[0].value);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedDoc = docs.find((d) => d.id === selectedId);

  async function onSubmit() {
    if (!selectedId || !requests) return;
    setIsLoading(true);
    setError("");
    try {
      JSON.parse(requests); // validate JSON before sending
      logger.info(`[docs-batch-update] documentId=${selectedId}`);
      const stdout = await execGws(
        `docs documents batchUpdate --params '${JSON.stringify({ documentId: selectedId })}' --json '${JSON.stringify({ requests: JSON.parse(requests) })}'`,
        docsToken(),
        logger
      );
      logger.info(`[docs-batch-update] completed`);
      const resp = stdout.trim() ? JSON.parse(stdout) as { documentId?: string } : {};
      setResult(
        `**Batch update applied successfully**\n\nDocument: **${selectedDoc?.name ?? selectedId}**\n\nDocument ID: \`${resp.documentId ?? selectedId}\``
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[docs-batch-update] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Batch Update Document" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Update Another" onSubmit={() => setResult("")} style="secondary" />
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
            title={isLoading ? "Applying…" : "Apply Updates"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedId || !requests}
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
      <Form.Dropdown
        name="example"
        label="Example Request"
        value=""
        onChange={(v) => { if (v) setRequests(v); }}
      >
        <Form.Dropdown.Item key="none" title="— load example —" value="" />
        {EXAMPLES.map((ex) => (
          <Form.Dropdown.Item key={ex.label} title={ex.label} value={ex.value} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        name="requests"
        label="Requests (JSON array)"
        value={requests}
        onChange={setRequests}
      />
    </Form>
  );
}

const DocsBatchUpdateWidget = defineWidget({
  name: "docs-batch-update",
  description: "Apply batch updates to a Google Doc using the Docs API requests format",
  schema,
  component: DocsBatchUpdate,
});

export default DocsBatchUpdateWidget;
