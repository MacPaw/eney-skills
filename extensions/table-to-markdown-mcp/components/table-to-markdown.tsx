import { useState } from "react";
import { extname } from "node:path";
import { z } from "zod";
import * as _XLSX from "xlsx";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const XLSX = (_XLSX as any).default ?? _XLSX;
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  CardHeader,
  defineWidget,
  useCloseWidget,
} from "@eney/api";

const schema = z.object({
  source: z.string().optional().describe("Path to a CSV or Excel file to convert to Markdown."),
});

type Props = z.infer<typeof schema>;

// --- Conversion ---

function toMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  // Drop trailing rows where every cell is empty
  let last = rows.length - 1;
  while (last > 0 && rows[last].every((c) => String(c ?? "").trim() === "")) last--;
  const trimmed = rows.slice(0, last + 1);

  const cols = Math.max(...trimmed.map((r) => r.length));

  // Normalize cells — collapse newlines so each cell stays on one line
  const cells = trimmed.map((r) =>
    Array.from({ length: cols }, (_, i) =>
      String(r[i] ?? "")
        .replace(/\r?\n/g, " · ")
        .replace(/\\/g, "\\\\")
        .replace(/\|/g, "\\|")
        .trim()
    )
  );

  // Compute max width per column
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(3, ...cells.map((r) => r[c].length))
  );

  const fmt = (row: string[]) =>
    "| " + row.map((cell, c) => cell.padEnd(widths[c])).join(" | ") + " |";

  const separator = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";

  return [fmt(cells[0]), separator, ...cells.slice(1).map(fmt)].join("\n");
}

function parseFile(filePath: string, sheetName?: string): { sheets: string[]; markdown: string } {
  const workbook = XLSX.readFile(filePath);
  const sheets = workbook.SheetNames;
  const target = sheetName ?? sheets[0];
  const sheet = workbook.Sheets[target];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
  const markdown = toMarkdownTable(rows);
  return { sheets, markdown };
}

// --- Component ---

function TableToMarkdown(props: Props) {
  const closeWidget = useCloseWidget();

  const [filePath, setFilePath] = useState(props.source ?? "");
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function onFileChange(path: string) {
    setFilePath(path);
    setMarkdown("");
    setError("");
    setSheetName("");

    const ext = extname(path).toLowerCase();
    if (ext === ".xlsx" || ext === ".xls") {
      try {
        const { sheets } = parseFile(path);
        setSheets(sheets);
        setSheetName(sheets[0]);
      } catch {
        setSheets([]);
      }
    } else {
      setSheets([]);
    }
  }

  async function onConvert() {
    if (!filePath) return;
    setIsLoading(true);
    setError("");
    try {
      const { sheets, markdown } = parseFile(filePath, sheetName || undefined);
      setSheets(sheets);
      setMarkdown(markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onReset() {
    setFilePath("");
    setSheets([]);
    setSheetName("");
    setMarkdown("");
    setError("");
  }

  // Result screen
  if (markdown) {
    return (
      <Form
        header={<CardHeader title="Table to Markdown" iconBundleId="com.apple.TextEdit" />}
        actions={
          <ActionPanel layout="row">
            <Action title="Convert Another" onAction={onReset} style="secondary" />
            <Action title="Done" onAction={() => closeWidget(markdown)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={"```\n" + markdown + "\n```"} isScrollable />
      </Form>
    );
  }

  // Input screen
  return (
    <Form
      header={<CardHeader title="Table to Markdown" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Converting..." : "Convert"}
            onSubmit={onConvert}
            style="primary"
            isLoading={isLoading}
            isDisabled={!filePath}
          />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        name="file"
        label="CSV or Excel File"
        value={filePath || undefined}
        onChange={onFileChange}
        accept={["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]}
      />

      {sheets.length > 1 && (
        <Form.Dropdown
          name="sheet"
          label="Sheet"
          value={sheetName}
          onChange={setSheetName}
        >
          {sheets.map((s) => (
            <Form.Dropdown.Item key={s} title={s} value={s} />
          ))}
        </Form.Dropdown>
      )}
    </Form>
  );
}

const TableToMarkdownWidget = defineWidget({
  name: "table-to-markdown",
  description: "Convert a CSV or Excel spreadsheet into a formatted Markdown table",
  schema,
  component: TableToMarkdown,
});

export default TableToMarkdownWidget;
