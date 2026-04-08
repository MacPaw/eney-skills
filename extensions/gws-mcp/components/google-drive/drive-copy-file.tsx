import { useEffect, useState } from "react";
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
  fileId: z.string().optional().describe("ID of the file to copy."),
  name: z.string().optional().describe("Name for the copied file. Defaults to 'Copy of <original name>'."),
});

type Props = z.infer<typeof schema>;

function DriveCopyFile(props: Props) {
  const closeWidget = useCloseWidget();
  const runScript = useAppleScript();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();
  const [selectedId, setSelectedId] = useState(props.fileId ?? "");
  const [newName, setNewName] = useState(props.name ?? "");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!props.name) {
      const file = files.find((f) => f.id === selectedId);
      if (file) setNewName(`Copy of ${file.name}`);
    }
  }, [selectedId, files, props.name]);

  async function onSubmit() {
    if (!selectedId) return;
    setIsLoading(true);
    setError("");
    try {
      const body = newName ? { name: newName } : {};
      const stdout = await execGws(
          `drive files copy --params '${JSON.stringify({ fileId: selectedId })}' --json '${JSON.stringify(body)}'`,
          driveToken()
      );
      const data = JSON.parse(stdout) as { id?: string; name?: string };
      const url = `https://drive.google.com/file/d/${data.id}/view`;
      setNewFileUrl(url);
      setResult(
        `**File copied successfully**\n\n| | |\n| --- | --- |\n| **New Name** | ${data.name ?? "—"} |\n| **New ID** | \`${data.id ?? "—"}\` |`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Copy File" iconBundleId="com.google.drivefs" />
  );

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="View File" style="secondary" onAction={() => runScript(`open location "${newFileUrl}"`)} />
            <Action title="Done" onAction={() => closeWidget(newFileUrl)} style="primary" />
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
            title={isLoading ? "Copying…" : "Copy File"}
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
        label="File to Copy"
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
        name="newName"
        label="New Name"
        value={newName}
        onChange={setNewName}
      />
    </Form>
  );
}

const DriveCopyFileWidget = defineWidget({
  name: "drive-copy-file",
  description: "Copy a file in Google Drive",
  schema,
  component: DriveCopyFile,
});

export default DriveCopyFileWidget;
