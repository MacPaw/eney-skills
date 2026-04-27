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
} from "@eney/api";
import { execGws, driveToken } from "../../helpers/gws.js";
import { useDriveFiles } from "../../helpers/use-drive-files.js";

const schema = z.object({
  fileId: z.string().optional().describe("ID of the Drive file to get comments for."),
});

type Props = z.infer<typeof schema>;

interface Comment {
  id?: string;
  content?: string;
  resolved?: boolean;
  createdTime?: string;
  author?: { displayName?: string };
}

function DriveFileComments(props: Props) {
  const closeWidget = useCloseWidget();
  const runScript = useAppleScript();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();
  const [selectedId, setSelectedId] = useState(props.fileId ?? "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [webViewLink, setWebViewLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function onLoad() {
    if (!selectedId) return;
    setIsLoading(true);
    setError("");
    try {
      const metaStdout = await execGws(
        ["drive", "files", "get", "--params", JSON.stringify({ fileId: selectedId, fields: "webViewLink" })],
        driveToken()
      );
      const meta = JSON.parse(metaStdout) as { webViewLink?: string };
      setWebViewLink(meta.webViewLink ?? "");

      const params = {
        fileId: selectedId,
        fields: "comments(id,content,resolved,createdTime,author)",
        pageSize: 100,
        includeDeleted: false,
      };
      const stdout = await execGws(
        ["drive", "comments", "list", "--params", JSON.stringify(params)],
        driveToken()
      );
      const data = JSON.parse(stdout) as { comments?: Comment[] };
      const items = data.comments ?? [];
      setComments(items);

      if (items.length === 0) {
        setResult("_No comments found on this file._");
        return;
      }

      const lines = items.map((c, i) => {
        const author = c.author?.displayName ?? "Unknown";
        const date = c.createdTime ? new Date(c.createdTime).toLocaleString() : "";
        const status = c.resolved ? "✓ Resolved" : "Open";
        return `**${i + 1}. ${author}** · ${date} · ${status}\n\n${c.content ?? ""}`;
      });
      setResult(`**${items.length} comment${items.length !== 1 ? "s" : ""}**\n\n${lines.join("\n\n---\n\n")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function buildOutput(): string {
    if (comments.length === 0) return "No comments found.";
    const lines = comments.map((c, i) => {
      const author = c.author?.displayName ?? "Unknown";
      const status = c.resolved ? "[resolved]" : "[open]";
      return `${i + 1}. ${author} ${status}: ${c.content ?? ""}`;
    });
    return `${comments.length} comment${comments.length !== 1 ? "s" : ""}:\n${lines.join("\n")}`;
  }

  const header = <CardHeader title="File Comments" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="View File" onAction={() => runScript(`open location "${webViewLink}"`)} style="secondary" isDisabled={!webViewLink} />
            <Action title="Done" onAction={() => closeWidget(webViewLink)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={result} isScrollable />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Divider />
          <Action
            title={isLoading ? "Loading…" : "Get Comments"}
            onAction={onLoad}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedId}
          />
        </ActionPanel>
      }
    >
      {filesError && <Paper markdown={`**Error loading files:** ${filesError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="fileId" label="File" value={selectedId} onChange={setSelectedId}>
        {isLoadingFiles
          ? [<Form.Dropdown.Item key="loading" title="Loading files…" value="" />]
          : files.map((f) => (
              <Form.Dropdown.Item key={f.id} title={f.name} value={f.id} />
            ))}
      </Form.Dropdown>
    </Form>
  );
}

const DriveFileCommentsWidget = defineWidget({
  name: "drive-file-comments",
  description: "List all comments on a Google Drive file",
  schema,
  component: DriveFileComments,
});

export default DriveFileCommentsWidget;
