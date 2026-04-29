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
import { execGws, driveToken, parseGwsError } from "../../helpers/gws.js";
import { useDriveFiles } from "../../helpers/use-drive-files.js";

const schema = z.object({
  fileId: z.string().optional().describe("ID of the Drive file to manage permissions for."),
});

type Props = z.infer<typeof schema>;
type Step = "select" | "list" | "add";

interface Permission {
  id?: string;
  emailAddress?: string;
  displayName?: string;
  role?: string;
  type?: string;
}

function DriveFilePermissions(props: Props) {
  const closeWidget = useCloseWidget();
  const { files, isLoading: isLoadingFiles, error: filesError } = useDriveFiles();
  const [selectedId, setSelectedId] = useState(props.fileId ?? "");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [webViewLink, setWebViewLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("select");
  const [info, setInfo] = useState("");

  // Add permission form
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("reader");

  async function onListPermissions() {
    if (!selectedId) return;
    setIsLoading(true);
    setError("");
    try {
      const [metaStdout, permStdout] = await Promise.all([
        execGws(["drive", "files", "get", "--params", JSON.stringify({ fileId: selectedId, fields: "webViewLink" })], driveToken()),
        execGws(["drive", "permissions", "list", "--params", JSON.stringify({ fileId: selectedId, fields: "permissions(id,emailAddress,displayName,role,type)" })], driveToken()),
      ]);
      const meta = JSON.parse(metaStdout) as { webViewLink?: string };
      setWebViewLink(meta.webViewLink ?? "");
      const data = JSON.parse(permStdout) as { permissions?: Permission[] };
      setPermissions(data.permissions ?? []);
      setStep("list");
    } catch (e) {
      setError(parseGwsError(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onAddPermission() {
    if (!selectedId || !newEmail) return;
    setIsLoading(true);
    setError("");
    try {
      const params = { fileId: selectedId };
      const body = { role: newRole, type: "user", emailAddress: newEmail };
      await execGws(
        ["drive", "permissions", "create", "--params", JSON.stringify(params), "--json", JSON.stringify(body)],
        driveToken()
      );
      setInfo(`Permission granted: ${newEmail} as ${newRole}.`);
      setNewEmail("");
      await onListPermissions();
    } catch (e) {
      setError(parseGwsError(e));
      setIsLoading(false);
    }
  }

  function buildPermissionsMarkdown(): string {
    if (permissions.length === 0) return "_No permissions found._";
    const rows = permissions.map((p) => {
      const who = p.emailAddress ?? p.displayName ?? p.type ?? "—";
      return `| ${who} | ${p.role ?? "—"} | ${p.type ?? "—"} |`;
    });
    return [
      `**${permissions.length} permission${permissions.length !== 1 ? "s" : ""}**\n`,
      "| Who | Role | Type |",
      "| --- | --- | --- |",
      ...rows,
    ].join("\n");
  }

  function buildOutput(): string {
    if (permissions.length === 0) return "No permissions found.";
    const lines = permissions.map((p) => {
      const who = p.emailAddress ?? p.displayName ?? p.type ?? "—";
      return `- ${who}: ${p.role ?? "—"} (${p.type ?? "—"})`;
    });
    return `${permissions.length} permission${permissions.length !== 1 ? "s" : ""}:\n${lines.join("\n")}`;
  }

  const header = <CardHeader title="File Permissions" iconBundleId="com.google.drivefs" />;

  if (step === "add") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={() => setStep("list")} style="secondary" />
            <Action
              title={isLoading ? "Adding…" : "Add Permission"}
              onAction={onAddPermission}
              style="primary"
              isLoading={isLoading}
              isDisabled={!newEmail || isLoading}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Form.TextField name="email" label="Email Address" value={newEmail} onChange={setNewEmail} />
        <Form.Dropdown name="role" label="Role" value={newRole} onChange={setNewRole}>
          <Form.Dropdown.Item value="reader" title="Viewer" />
          <Form.Dropdown.Item value="commenter" title="Commenter" />
          <Form.Dropdown.Item value="writer" title="Editor" />
        </Form.Dropdown>
      </Form>
    );
  }

  if (step === "list") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Add Permission" onAction={() => { setError(""); setStep("add"); }} style="secondary" />
            <Action title="Done" onAction={() => closeWidget(webViewLink || buildOutput())} style="primary" />
          </ActionPanel>
        }
      >
        {info && <Paper markdown={info} />}
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Paper markdown={buildPermissionsMarkdown()} />
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
            title={isLoading ? "Loading…" : "List Permissions"}
            onAction={onListPermissions}
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

const DriveFilePermissionsWidget = defineWidget({
  name: "drive-file-permissions",
  description: "List and manage permissions on a Google Drive file — view who has access and grant access to new users",
  schema,
  component: DriveFilePermissions,
});

export default DriveFilePermissionsWidget;
