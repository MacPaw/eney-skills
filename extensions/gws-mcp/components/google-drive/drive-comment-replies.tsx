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
} from "@eney/api";
import { execGws, driveToken } from "../../helpers/gws.js";
import { useDriveFiles } from "../../helpers/use-drive-files.js";

const schema = z.object({
  fileId: z.string().optional().describe("ID of the Drive file to get comment replies for."),
  commentId: z.string().optional().describe("ID of the comment to get replies for."),
});

type Props = z.infer<typeof schema>;

interface Comment {
  id: string;
  content?: string;
  author?: { displayName?: string };
}

interface Reply {
  id?: string;
  content?: string;
  createdTime?: string;
  author?: { displayName?: string };
}

function DriveCommentReplies(props: Props) {
  const closeWidget = useCloseWidget();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();

  const [selectedFileId, setSelectedFileId] = useState(props.fileId ?? "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState(props.commentId ?? "");

  const [replies, setReplies] = useState<Reply[]>([]);
  const [webViewLink, setWebViewLink] = useState("");
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function onLoadComments(fileId: string) {
    if (!fileId) return;
    setIsLoadingComments(true);
    setComments([]);
    setSelectedCommentId("");
    setResult("");
    setError("");
    try {
      const params = {
        fileId,
        fields: "comments(id,content,author)",
        pageSize: 100,
        includeDeleted: false,
      };
      const stdout = await execGws(
        `drive comments list --params '${JSON.stringify(params)}'`,
        driveToken()
      );
      const data = JSON.parse(stdout) as { comments?: Comment[] };
      setComments(data.comments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingComments(false);
    }
  }

  function onFileChange(fileId: string) {
    setSelectedFileId(fileId);
    void onLoadComments(fileId);
  }

  async function onLoadReplies() {
    if (!selectedFileId || !selectedCommentId) return;
    setIsLoadingReplies(true);
    setError("");
    try {
      const metaStdout = await execGws(
        `drive files get --params '${JSON.stringify({ fileId: selectedFileId, fields: "webViewLink" })}'`,
        driveToken()
      );
      const meta = JSON.parse(metaStdout) as { webViewLink?: string };
      setWebViewLink(meta.webViewLink ?? "");

      const params = {
        fileId: selectedFileId,
        commentId: selectedCommentId,
        fields: "replies(id,content,createdTime,author)",
        pageSize: 100,
        includeDeleted: false,
      };
      const stdout = await execGws(
        `drive replies list --params '${JSON.stringify(params)}'`,
        driveToken()
      );
      const data = JSON.parse(stdout) as { replies?: Reply[] };
      const items = data.replies ?? [];
      setReplies(items);

      const selectedComment = comments.find((c) => c.id === selectedCommentId);
      const commentSnippet = selectedComment?.content
        ? `> ${selectedComment.content.slice(0, 80)}${selectedComment.content.length > 80 ? "…" : ""}`
        : "";

      if (items.length === 0) {
        setResult(`${commentSnippet}\n\n_No replies on this comment._`);
        return;
      }

      const lines = items.map((r, i) => {
        const author = r.author?.displayName ?? "Unknown";
        const date = r.createdTime ? new Date(r.createdTime).toLocaleString() : "";
        return `**${i + 1}. ${author}** · ${date}\n\n${r.content ?? ""}`;
      });
      setResult(
        `${commentSnippet}\n\n**${items.length} repl${items.length !== 1 ? "ies" : "y"}**\n\n${lines.join("\n\n---\n\n")}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingReplies(false);
    }
  }

  function buildOutput(): string {
    if (replies.length === 0) return "No replies found.";
    const lines = replies.map((r, i) => {
      const author = r.author?.displayName ?? "Unknown";
      return `${i + 1}. ${author}: ${r.content ?? ""}`;
    });
    const selectedComment = comments.find((c) => c.id === selectedCommentId);
    const snippet = selectedComment?.content?.slice(0, 60) ?? selectedCommentId;
    return `Replies to "${snippet}":\n${lines.join("\n")}`;
  }

  const header = <CardHeader title="Comment Replies" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Back" onAction={() => setResult("")} style="secondary" />
            <Action title="Done" onAction={() => closeWidget(webViewLink || buildOutput())} style="primary" />
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
            title={isLoadingReplies ? "Loading…" : "Get Replies"}
            onAction={onLoadReplies}
            style="primary"
            isLoading={isLoadingReplies}
            isDisabled={!selectedFileId || !selectedCommentId || isLoadingComments}
          />
        </ActionPanel>
      }
    >
      {filesError && <Paper markdown={`**Error loading files:** ${filesError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="fileId" label="File" value={selectedFileId} onChange={onFileChange}>
        {isLoadingFiles
          ? [<Form.Dropdown.Item key="loading" title="Loading files…" value="" />]
          : files.map((f) => (
              <Form.Dropdown.Item key={f.id} title={f.name} value={f.id} />
            ))}
      </Form.Dropdown>
      <Form.Dropdown
        name="commentId"
        label="Comment"
        value={selectedCommentId}
        onChange={setSelectedCommentId}
      >
        {isLoadingComments
          ? [<Form.Dropdown.Item key="loading" title="Loading comments…" value="" />]
          : comments.length === 0
          ? [<Form.Dropdown.Item key="empty" title={selectedFileId ? "No comments on this file" : "Select a file first"} value="" />]
          : comments.map((c) => {
              const label = c.author?.displayName
                ? `${c.author.displayName}: ${(c.content ?? "").slice(0, 50)}`
                : (c.content ?? c.id).slice(0, 60);
              return <Form.Dropdown.Item key={c.id} title={label} value={c.id} />;
            })}
      </Form.Dropdown>
    </Form>
  );
}

const DriveCommentRepliesWidget = defineWidget({
  name: "drive-comment-replies",
  description: "List replies to a comment on a Google Drive file — select a file, pick a comment, view its replies",
  schema,
  component: DriveCommentReplies,
});

export default DriveCommentRepliesWidget;
