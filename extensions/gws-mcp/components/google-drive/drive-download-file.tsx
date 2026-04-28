import { useEffect, useState } from "react";
import { homedir } from "os";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
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
import { execGws, driveToken, parseGwsError } from "../../helpers/gws.js";
import { useDriveFiles } from "../../helpers/use-drive-files.js";

const schema = z.object({
  fileId: z.string().optional().describe("ID of the file to download."),
  outputPath: z
    .string()
    .optional()
    .describe("Local path to save the file. Defaults to ~/Downloads/<filename>."),
});

type Props = z.infer<typeof schema>;

function DriveDownloadFile(props: Props) {
  const closeWidget = useCloseWidget();
  const runScript = useAppleScript();
  const logger = useLogger();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();
  const [selectedId, setSelectedId] = useState(props.fileId ?? "");
  const [outputPath, setOutputPath] = useState(props.outputPath ?? "");
  const [result, setResult] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!props.outputPath) {
      const file = files.find((f) => f.id === selectedId);
      if (file) setOutputPath(`${homedir()}/Downloads/${file.name}`);
    }
  }, [selectedId, files, props.outputPath]);

  async function onSubmit() {
    if (!selectedId || !outputPath) return;
    setIsLoading(true);
    setError("");
    try {
      const resolvedPath = outputPath.replace(/^~/, homedir());
      logger.info(`[download] fileId=${selectedId} resolvedPath=${resolvedPath}`);
      const stdout = await execGws(
          ["drive", "files", "download", "--params", JSON.stringify({ fileId: selectedId }), "-o", resolvedPath],
          driveToken()
      );
      logger.info(`[download] completed stdout=${stdout.trim() || "(empty)"}`);
      const parsed = stdout.trim() ? JSON.parse(stdout) as { response?: { downloadUri?: string } } : null;
      if (parsed?.response?.downloadUri) {
        logger.info(`[download] Google Workspace file — fetching downloadUri`);
        const uri = parsed.response.downloadUri;
        const exportFormat = new URL(uri).searchParams.get("exportFormat");
        const finalPath = exportFormat && !resolvedPath.endsWith(`.${exportFormat}`)
          ? `${resolvedPath}.${exportFormat}`
          : resolvedPath;
        const token = driveToken();
        const resp = await fetch(uri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok || !resp.body) {
          throw new Error(`Failed to fetch downloadUri: ${resp.status} ${resp.statusText}`);
        }
        await pipeline(
          resp.body as unknown as NodeJS.ReadableStream,
          createWriteStream(finalPath)
        );
        logger.info(`[download] written via downloadUri to ${finalPath}`);
        setSavedPath(finalPath);
        setResult(`**File downloaded successfully**\n\nSaved to: \`${finalPath}\``);
        return;
      }
      setSavedPath(resolvedPath);
      setResult(`**File downloaded successfully**\n\nSaved to: \`${resolvedPath}\``);
    } catch (e) {
      setError(parseGwsError(e));
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Download File" iconBundleId="com.google.drivefs" />
  );

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Show in Finder" style="secondary" onAction={() => runScript(`tell application "Finder"\nreveal POSIX file "${savedPath}"\nactivate\nend tell`)} />
            <Action title="Done" onAction={() => closeWidget(savedPath)} style="primary" />
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
            title={isLoading ? "Downloading…" : "Download"}
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
      <Form.TextField
        name="outputPath"
        label="Save to"
        value={outputPath}
        onChange={setOutputPath}
      />
    </Form>
  );
}

const DriveDownloadFileWidget = defineWidget({
  name: "drive-download-file",
  description: "Download a file from Google Drive to local disk",
  schema,
  component: DriveDownloadFile,
});

export default DriveDownloadFileWidget;
