import { useEffect, useState } from "react";
import { homedir } from "os";
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
import { useDriveFiles } from "../../helpers/use-drive-files.js";

const schema = z.object({
  fileId: z.string().optional().describe("ID of the Google Workspace file to export."),
  mimeType: z.string().optional().describe("Target MIME type for the exported file."),
  outputPath: z.string().optional().describe("Local path to save the exported file."),
});

type Props = z.infer<typeof schema>;

const MIME_OPTIONS = [
  { label: "PDF (.pdf)", value: "application/pdf", ext: "pdf" },
  { label: "Word (.docx)", value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  { label: "Excel (.xlsx)", value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  { label: "PowerPoint (.pptx)", value: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: "pptx" },
  { label: "Plain Text (.txt)", value: "text/plain", ext: "txt" },
  { label: "CSV (.csv)", value: "text/csv", ext: "csv" },
];

function DriveExportFile(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();
  const [selectedId, setSelectedId] = useState(props.fileId ?? "");
  const [mimeType, setMimeType] = useState(props.mimeType ?? "application/pdf");
  const [outputPath, setOutputPath] = useState(props.outputPath ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!props.outputPath) {
      const file = files.find((f) => f.id === selectedId);
      const option = MIME_OPTIONS.find((o) => o.value === mimeType);
      if (file && option) {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        setOutputPath(`${homedir()}/Downloads/${baseName}.${option.ext}`);
      }
    }
  }, [selectedId, mimeType, files, props.outputPath]);

  async function onSubmit() {
    if (!selectedId || !mimeType || !outputPath) return;
    setIsLoading(true);
    setError("");
    try {
      const resolvedPath = outputPath.replace(/^~/, homedir());
      await execGws(
          `drive files export --params '${JSON.stringify({ fileId: selectedId, mimeType })}' -o "${resolvedPath}"`,
          driveToken(),
          logger
      );
      setResult(`**File exported successfully**\n\nSaved to: \`${resolvedPath}\``);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Export File" iconBundleId="com.google.drivefs" />
  );

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Export Another" onSubmit={() => setResult("")} style="secondary" />
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
            title={isLoading ? "Exporting…" : "Export"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedId || !outputPath}
          />
        </ActionPanel>
      }
    >
      {filesError && <Paper markdown={`**Error loading files:** ${filesError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown
        name="fileId"
        label="File"
        value={selectedId}
        onChange={setSelectedId}
      >
        {isLoadingFiles
          ? [<Form.Dropdown.Item key="loading" title="Loading files…" value="" />]
          : files.map((f) => (
              <Form.Dropdown.Item key={f.id} title={f.name} value={f.id} />
            ))}
      </Form.Dropdown>
      <Form.Dropdown
        name="mimeType"
        label="Export Format"
        value={mimeType}
        onChange={setMimeType}
      >
        {MIME_OPTIONS.map((o) => (
          <Form.Dropdown.Item key={o.value} title={o.label} value={o.value} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        name="outputPath"
        label="Save to"
        value={outputPath}
        onChange={setOutputPath}
      />
    </Form>
  );
}

const DriveExportFileWidget = defineWidget({
  name: "drive-export-file",
  description: "Export a Google Drive file to PDF, DOCX, XLSX, and other formats",
  schema,
  component: DriveExportFile,
});

export default DriveExportFileWidget;
