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
import { useDriveFiles } from "../../helpers/use-drive-files.js";

const schema = z.object({
  fileId: z.string().optional().describe("ID of the Drive file to inspect."),
});

type Props = z.infer<typeof schema>;

interface FileMetadata {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  owners?: Array<{ displayName?: string }>;
  webViewLink?: string;
}

function formatMetadata(data: FileMetadata): string {
  const sizeStr = data.size
    ? `${(parseInt(data.size) / 1024).toFixed(1)} KB`
    : "—";
  const rows = [
    `| **Name** | ${data.name ?? "—"} |`,
    `| **Type** | ${data.mimeType ?? "—"} |`,
    `| **Size** | ${sizeStr} |`,
    `| **Created** | ${data.createdTime ? new Date(data.createdTime).toLocaleString() : "—"} |`,
    `| **Modified** | ${data.modifiedTime ? new Date(data.modifiedTime).toLocaleString() : "—"} |`,
    `| **Owner** | ${data.owners?.[0]?.displayName ?? "—"} |`,
    `| **Link** | ${data.webViewLink ? `[Open](${data.webViewLink})` : "—"} |`,
  ];
  return ["| Property | Value |", "| --- | --- |", ...rows].join("\n");
}

function DriveGetFileMetadata(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();
  const [selectedId, setSelectedId] = useState(props.fileId ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!selectedId) return;
    setIsLoading(true);
    setError("");
    try {
      const params = {
        fileId: selectedId,
        fields: "id,name,mimeType,size,createdTime,modifiedTime,owners,webViewLink",
      };
      const stdout = await execGws(
          `drive files get --params '${JSON.stringify(params)}'`,
          driveToken(),
          logger
      );
      setResult(formatMetadata(JSON.parse(stdout) as FileMetadata));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Get File Metadata" iconBundleId="com.google.drivefs" />
  );

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Check Another" onSubmit={() => setResult("")} style="secondary" />
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
            title={isLoading ? "Fetching…" : "Get Metadata"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedId}
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
    </Form>
  );
}

const DriveGetFileMetadataWidget = defineWidget({
  name: "drive-get-file-metadata",
  description: "Get metadata for a Google Drive file",
  schema,
  component: DriveGetFileMetadata,
});

export default DriveGetFileMetadataWidget;
