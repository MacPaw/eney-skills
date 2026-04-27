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
import { execGws, driveToken, parseGwsError } from "../../helpers/gws.js";
import { useDriveFolders } from "../../helpers/use-drive-folders.js";
import { markdownToDocRequests, hasMarkdown, categorizeError } from "../../helpers/markdown-to-requests.js";

const schema = z.object({
  title: z.string().optional().describe("Title for the new Google Doc."),
  content: z.string().optional().describe("Initial content. Supports markdown: # heading, ## heading, ### heading, - list item."),
  folderId: z.string().optional().describe("ID of the Drive folder to place the document in."),
});

type Props = z.infer<typeof schema>;

interface DocResponse {
  documentId?: string;
  title?: string;
}

function DocsCreate(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { folders, isLoading: isLoadingFolders } = useDriveFolders();

  const [title, setTitle] = useState(props.title ?? "");
  const [content, setContent] = useState(props.content ?? "");
  const [folderId, setFolderId] = useState(props.folderId ?? "");
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("reader");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!title) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[docs-create] title="${title}" folderId="${folderId}" shareEmail="${shareEmail}"`);

      // Step 1: Create blank document
      const stdout = await execGws(
        ["docs", "documents", "create", "--json", JSON.stringify({ title })],
        driveToken()
      );
      const doc = JSON.parse(stdout) as DocResponse;
      const docId = doc.documentId ?? "";
      logger.info(`[docs-create] documentId=${docId}`);

      // Step 2: Insert formatted content if provided
      if (content.trim() && docId) {
        let requests: object[];
        if (hasMarkdown(content)) {
          // New doc body: sectionBreak at 0, empty paragraph at index 1 → insert at 1
          requests = markdownToDocRequests(content, 1);
        } else {
          requests = [{ insertText: { location: { index: 1 }, text: content } }];
        }
        if (requests.length > 0) {
          logger.info(`[docs-create] batchUpdate requests=${requests.length}`);
          await execGws(
            ["docs", "documents", "batchUpdate", "--params", JSON.stringify({ documentId: docId }), "--json", JSON.stringify({ requests })],
            driveToken()
          );
        }
      }

      // Step 3: Move to folder if selected
      if (folderId && docId) {
        logger.info(`[docs-create] moving to folderId=${folderId}`);
        await execGws(
          ["drive", "files", "update", "--params", JSON.stringify({ fileId: docId, addParents: folderId, removeParents: "root" }), "--json", "{}"],
          driveToken()
        );
      }

      // Step 4: Share if email provided
      if (shareEmail.trim() && docId) {
        logger.info(`[docs-create] sharing with ${shareEmail} as ${shareRole}`);
        await execGws(
          ["drive", "permissions", "create", "--params", JSON.stringify({ fileId: docId, sendNotificationEmail: false }), "--json", JSON.stringify({ role: shareRole, type: "user", emailAddress: shareEmail.trim() })],
          driveToken()
        );
      }

      const link = `https://docs.google.com/document/d/${docId}/edit`;
      const folderName = folders.find((f) => f.id === folderId)?.name;
      const steps = [
        `✓ Document created: **${doc.title ?? title}**`,
        content.trim() ? `✓ Content inserted` : null,
        folderName ? `✓ Placed in **${folderName}**` : null,
        shareEmail.trim() ? `✓ Shared with ${shareEmail.trim()} (${shareRole})` : null,
      ].filter(Boolean).join("\n");

      closeWidget(`${steps}\n${link}`);
    } catch (e) {
      const msg = parseGwsError(e);
      logger.error(`[docs-create] error=${msg}`);
      setError(categorizeError(msg));
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Create Document" iconBundleId="com.google.drivefs" />;

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Divider />
          <Action.SubmitForm
            title={isLoading ? "Creating…" : "Create Document"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!title}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={error} />}
      <Form.TextField name="title" label="Document Title" value={title} onChange={setTitle} />
      <Form.RichTextEditor value={content} onChange={setContent} isInitiallyFocused />
      <Form.Dropdown name="folderId" label="Folder" value={folderId} onChange={setFolderId}>
        <Form.Dropdown.Item key="root" title="My Drive (root)" value="" />
        {isLoadingFolders
          ? [<Form.Dropdown.Item key="loading" title="Loading folders…" value="__loading__" />]
          : folders.map((f) => (
              <Form.Dropdown.Item key={f.id} title={f.name} value={f.id} />
            ))}
      </Form.Dropdown>
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

const DocsCreateWidget = defineWidget({
  name: "docs-create",
  description: "Create a new Google Doc with optional formatted content, folder placement, and sharing",
  schema,
  component: DocsCreate,
});

export default DocsCreateWidget;
