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
  useAppleScript,
  useCloseWidget,
  useLogger,
} from "@eney/api";
import { execGws, driveToken } from "../../helpers/gws.js";
import { useDocFiles } from "../../helpers/use-doc-files.js";

const schema = z.object({
  documentId: z.string().optional().describe("ID of the Google Doc to read."),
});

type Props = z.infer<typeof schema>;

interface TextRun {
  content?: string;
}

interface ParagraphElement {
  textRun?: TextRun;
}

interface Paragraph {
  elements?: ParagraphElement[];
}

interface StructuralElement {
  paragraph?: Paragraph;
}

interface DocResponse {
  title?: string;
  documentId?: string;
  body?: { content?: StructuralElement[] };
}

function extractText(doc: DocResponse): string {
  return (doc.body?.content ?? [])
    .flatMap((el) => el.paragraph?.elements ?? [])
    .map((el) => el.textRun?.content ?? "")
    .join("")
    .trim();
}

function formatDoc(doc: DocResponse): string {
  const text = extractText(doc);
  const preview = text.length > 800 ? text.slice(0, 800) + "…" : text;
  return [
    `**Title:** ${doc.title ?? "—"}`,
    "",
    `**Document ID:** \`${doc.documentId ?? "—"}\``,
    "",
    "---",
    "",
    preview || "_Empty document_",
  ].join("\n");
}

function DocsGet(props: Props) {
  const closeWidget = useCloseWidget();
  const runScript = useAppleScript();
  const logger = useLogger();
  const { docs, isLoading: isLoadingDocs, error: docsError } = useDocFiles();
  const [selectedId, setSelectedId] = useState(props.documentId ?? "");
  const [result, setResult] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!selectedId) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[docs-get] documentId=${selectedId}`);
      const stdout = await execGws(
        ["docs", "documents", "get", "--params", JSON.stringify({ documentId: selectedId })],
        driveToken()
      );
      const doc = JSON.parse(stdout) as DocResponse;
      setFileUrl(`https://docs.google.com/document/d/${doc.documentId}/edit`);
      setResult(formatDoc(doc));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[docs-get] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Get Document" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="View File" style="secondary" onAction={() => runScript(`open location "${fileUrl}"`)} />
            <Action title="Done" onAction={() => closeWidget(fileUrl)} style="primary" />
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
            title={isLoading ? "Reading…" : "Read Document"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedId}
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
    </Form>
  );
}

const DocsGetWidget = defineWidget({
  name: "docs-get",
  description: "Read the content and metadata of a Google Doc",
  schema,
  component: DocsGet,
});

export default DocsGetWidget;
