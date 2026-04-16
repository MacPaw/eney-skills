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
import { execGws, driveToken } from "../../helpers/gws.js";
import { useDocFiles } from "../../helpers/use-doc-files.js";
import { markdownToDocRequests, hasMarkdown, categorizeError } from "../../helpers/markdown-to-requests.js";

const schema = z.object({
  documentId: z.string().optional().describe("ID of the Google Doc to append text to."),
  text: z.string().optional().describe("Text to append. Supports markdown: # heading, - list item."),
});

type Props = z.infer<typeof schema>;

interface StructuralElement {
  endIndex?: number;
}

interface DocBodyResponse {
  body?: { content?: StructuralElement[] };
}

async function getDocEndIndex(docId: string): Promise<number> {
  const stdout = await execGws(
    `docs documents get --params '${JSON.stringify({ documentId: docId })}'`,
    driveToken()
  );
  const doc = JSON.parse(stdout) as DocBodyResponse;
  const content = doc.body?.content ?? [];
  const last = content[content.length - 1];
  return last?.endIndex ?? 2;
}

function DocsWrite(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { docs, isLoading: isLoadingDocs, error: docsError } = useDocFiles();
  const [selectedId, setSelectedId] = useState(props.documentId ?? "");
  const [text, setText] = useState(props.text ?? "");
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("reader");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedDoc = docs.find((d) => d.id === selectedId);

  async function onSubmit() {
    if (!selectedId || !text) return;
    setIsLoading(true);
    setError("");
    try {
      const normalizedText = text.replace(/\\n/g, "\n");
      logger.info(`[docs-write] documentId=${selectedId} textLen=${normalizedText.length}`);

      const endIndex = await getDocEndIndex(selectedId);
      const insertAt = endIndex - 1;
      logger.info(`[docs-write] batchUpdate at index=${insertAt}`);
      const requests = hasMarkdown(normalizedText)
        ? markdownToDocRequests("\n" + normalizedText, insertAt)
        : [{ insertText: { location: { index: insertAt }, text: "\n" + normalizedText } }];
      await execGws(
        `docs documents batchUpdate --params '${JSON.stringify({ documentId: selectedId })}' --json '${JSON.stringify({ requests })}'`,
        driveToken()
      );

      logger.info(`[docs-write] completed`);

      // Share if email provided
      if (shareEmail.trim()) {
        logger.info(`[docs-write] sharing with ${shareEmail} as ${shareRole}`);
        await execGws(
          `drive permissions create --params '${JSON.stringify({ fileId: selectedId, sendNotificationEmail: false })}' --json '${JSON.stringify({ role: shareRole, type: "user", emailAddress: shareEmail.trim() })}'`,
          driveToken()
        );
      }

      const link = `https://docs.google.com/document/d/${selectedId}/edit`;
      const docName = selectedDoc?.name ?? selectedId;
      const steps = [
        `✓ Text appended to "${docName}"`,
        hasMarkdown(text) ? `✓ Formatting applied` : null,
        shareEmail.trim() ? `✓ Shared with ${shareEmail.trim()} (${shareRole})` : null,
      ].filter(Boolean).join("\n");

      closeWidget(`${steps}\n${link}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[docs-write] error=${msg}`);
      setError(categorizeError(msg));
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Append to Document" iconBundleId="com.google.drivefs" />;

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
      {error && <Paper markdown={error} />}
      <Form.Dropdown name="documentId" label="Document" value={selectedId} onChange={setSelectedId}>
        {isLoadingDocs
          ? [<Form.Dropdown.Item key="loading" title="Loading documents…" value="" />]
          : docs.map((d) => (
              <Form.Dropdown.Item key={d.id} title={d.name} value={d.id} />
            ))}
      </Form.Dropdown>
      <Form.RichTextEditor value={text} onChange={setText} isInitiallyFocused />
      <Form.TextField
        name="shareEmail"
        label="Share with email (optional)"
        value={shareEmail}
        onChange={setShareEmail}
      />
      <Form.Dropdown name="shareRole" label="Share role" value={shareRole} onChange={setShareRole}>
        <Form.Dropdown.Item key="reader" title="Viewer" value="reader" />
        <Form.Dropdown.Item key="commenter" title="Commenter" value="commenter" />
        <Form.Dropdown.Item key="writer" title="Editor" value="writer" />
      </Form.Dropdown>
    </Form>
  );
}

const DocsWriteWidget = defineWidget({
  name: "docs-write",
  description: "Append text to a Google Doc with optional markdown formatting and sharing",
  schema,
  component: DocsWrite,
});

export default DocsWriteWidget;
