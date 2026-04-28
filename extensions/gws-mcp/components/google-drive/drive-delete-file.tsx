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
import { useDriveFiles } from "../../helpers/use-drive-files.js";

const schema = z.object({
  fileId: z.string().optional().describe("ID of the file to move to trash."),
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
      logger.info(`[trash] fileId=${selectedId} name="${selectedFile?.name ?? "unknown"}"`);
      const stdout = await execGws(
        ["drive", "files", "update", "--params", JSON.stringify({ fileId: selectedId }), "--json", JSON.stringify({ trashed: true })],
        driveToken()
      );
      logger.info(`[trash] completed stdout=${stdout.trim() || "(empty)"}`);
      closeWidget(
        `File "${selectedFile?.name ?? selectedId}" has been moved to Trash.`
      );
    } catch (e) {
      const msg = parseGwsError(e);
      logger.error(`[trash] error=${msg}`);
      setError(msg);
      setIsLoading(false);
      setStep("select");
    }
  }

  const header = (
    <CardHeader title="Move File to Trash" iconBundleId="com.google.drivefs" />
  );

  if (step === "confirm") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={() => setStep("select")} style="secondary" />
            <Action
              title={isLoading ? "Moving…" : "Move to Trash"}
              onAction={onDelete}
              style="primary"
              isLoading={isLoading}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Paper
          markdown={`**Move this file to Trash?**\n\n> **${selectedFile?.name ?? selectedId}**\n\nThe file will be moved to Trash. You can restore it from Trash later.`}
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
        label="File to Move to Trash"
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
  description: "Move a file to Trash in Google Drive",
  schema,
  component: DriveDeleteFile,
});

export default DriveDeleteFileWidget;
