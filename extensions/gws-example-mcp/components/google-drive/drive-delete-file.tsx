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
  fileId: z.string().optional().describe("ID of the file to permanently delete."),
});

type Props = z.infer<typeof schema>;

type Step = "select" | "confirm";

function DriveDeleteFile(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();
  const [selectedId, setSelectedId] = useState(props.fileId ?? "");
  const [step, setStep] = useState<Step>("select");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedFile = files.find((f) => f.id === selectedId);

  async function onDelete() {
    if (!selectedId) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[delete] fileId=${selectedId} name="${selectedFile?.name ?? "unknown"}"`);
      const stdout = await execGws(
          `drive files delete --params '${JSON.stringify({ fileId: selectedId })}' -o /dev/null`,
          driveToken(),
          logger
      );
      logger.info(`[delete] completed stdout=${stdout.trim() || "(empty)"}`);
      closeWidget(
        `File "${selectedFile?.name ?? selectedId}" has been permanently deleted.`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[delete] error=${msg}`);
      setError(msg);
      setIsLoading(false);
      setStep("select");
    }
  }

  const header = (
    <CardHeader title="Delete File" iconBundleId="com.google.drivefs" />
  );

  if (step === "confirm") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={() => setStep("select")} style="secondary" />
            <Action
              title={isLoading ? "Deleting…" : "Delete Permanently"}
              onAction={onDelete}
              style="primary"
              isLoading={isLoading}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Paper
          markdown={`**Are you sure you want to delete this file?**\n\n> **${selectedFile?.name ?? selectedId}**\n\nThis action cannot be undone. The file will be permanently deleted and will not be moved to trash.`}
        />
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
            title="Continue"
            onSubmit={() => setStep("confirm")}
            style="primary"
            isDisabled={!selectedId}
          />
        </ActionPanel>
      }
    >
      {filesError && <Paper markdown={`**Error loading files:** ${filesError}`} />}
      <Form.Dropdown
        name="fileId"
        label="File to Delete"
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

const DriveDeleteFileWidget = defineWidget({
  name: "drive-delete-file",
  description: "Permanently delete a file from Google Drive",
  schema,
  component: DriveDeleteFile,
});

export default DriveDeleteFileWidget;
