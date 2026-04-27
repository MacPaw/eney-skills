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

const schema = z.object({
  title: z.string().optional().describe("Title for the new Google Spreadsheet. Defaults to 'New Sheet – {date}'."),
  content: z
    .string()
    .optional()
    .describe(
      "Content to populate. Accepts: markdown table (| Col | Col |), bullet list (- item), or comma-separated rows."
    ),
});

type Props = z.infer<typeof schema>;

interface DriveFileResponse {
  id?: string;
  name?: string;
  webViewLink?: string;
}

/**
 * Parse markdown/text content into a 2D array of cell values.
 * Handles: markdown tables, bullet lists, comma-separated lines, plain lines.
 */
function parseContent(raw: string): string[][] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Markdown table: lines starting with |
  const tableLines = lines.filter((l) => l.startsWith("|"));
  if (tableLines.length > 0) {
    return tableLines
      .filter((l) => !/^\|[-:|\s]+\|$/.test(l)) // remove separator rows
      .map((l) =>
        l
          .split("|")
          .map((c) => c.trim())
          .filter((c, i, arr) => i > 0 && i < arr.length - 1) // skip empty first/last
      );
  }

  // Bullet list: all lines are bullets
  const bulletLines = lines.filter((l) => /^[-*+]\s/.test(l));
  if (bulletLines.length === lines.length) {
    return bulletLines.map((l) => [l.replace(/^[-*+]\s+/, "")]);
  }

  // CSV-like or plain lines
  return lines.map((l) => {
    if (l.includes(",")) return l.split(",").map((c) => c.trim());
    return [l];
  });
}

function defaultTitle(): string {
  return `New Sheet – ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}`;
}

function SheetsCreate(props: Props) {
  const closeWidget = useCloseWidget();
  const runScript = useAppleScript();
  const logger = useLogger();

  const [title, setTitle] = useState(props.title ?? "");
  const [content, setContent] = useState(props.content ?? "");
  const [fileUrl, setFileUrl] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    const sheetTitle = title.trim() || defaultTitle();
    setIsLoading(true);
    setError("");
    try {
      // Step 1: Create spreadsheet via Drive
      logger.info(`[sheets-create] title="${sheetTitle}"`);
      const createStdout = await execGws(
        ["drive", "files", "create", "--json", JSON.stringify({
          name: sheetTitle,
          mimeType: "application/vnd.google-apps.spreadsheet",
        })],
        driveToken()
      );
      const file = JSON.parse(createStdout) as DriveFileResponse;
      const fileId = file.id;
      if (!fileId) throw new Error("Drive returned no file ID");
      logger.info(`[sheets-create] fileId=${fileId}`);

      const link = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
      setFileUrl(link);

      // Step 2: Populate with parsed content
      const rows = parseContent(content);
      if (rows.length > 0) {
        logger.info(`[sheets-create] appending ${rows.length} rows`);
        await execGws(
          ["sheets", "+append", "--spreadsheet", fileId, "--json-values", JSON.stringify(rows)],
          driveToken()
        );
      }

      setResult(
        `**Spreadsheet created successfully**\n\n` +
          (rows.length > 0 ? `✓ ${rows.length} row${rows.length !== 1 ? "s" : ""} written\n\n` : "") +
          `| | |\n| --- | --- |\n| **Name** | ${file.name ?? sheetTitle} |\n| **ID** | \`${fileId}\` |`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[sheets-create] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Create Spreadsheet" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action
              title="View Sheet"
              style="secondary"
              onAction={() => runScript(`open location "${fileUrl}"`)}
            />
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
          <Action
            title={isLoading ? "Creating…" : "Create Spreadsheet"}
            onAction={onSubmit}
            style="primary"
            isLoading={isLoading}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField
        name="title"
        label="Spreadsheet Name"
        value={title}
        onChange={setTitle}
      />
      <Form.RichTextEditor
        value={content}
        onChange={setContent}
        isInitiallyFocused
      />
    </Form>
  );
}

const SheetsCreateWidget = defineWidget({
  name: "sheets-create",
  description: "Create a new Google Spreadsheet and populate it with table or list content",
  schema,
  component: SheetsCreate,
});

export default SheetsCreateWidget;
