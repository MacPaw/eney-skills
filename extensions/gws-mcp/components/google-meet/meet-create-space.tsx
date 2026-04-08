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
import { execGws, meetToken } from "../../helpers/gws.js";

const schema = z.object({
  accessType: z
    .enum(["OPEN", "TRUSTED", "RESTRICTED"])
    .optional()
    .describe("Who can join the meeting space. Defaults to OPEN."),
});

type Props = z.infer<typeof schema>;

const ACCESS_OPTIONS = [
  { label: "Open (anyone with link)", value: "OPEN" },
  { label: "Trusted (org members)", value: "TRUSTED" },
  { label: "Restricted (invited only)", value: "RESTRICTED" },
];

interface SpaceResponse {
  name?: string;
  meetingUri?: string;
  meetingCode?: string;
  config?: { accessType?: string };
}

function MeetCreateSpace(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const [accessType, setAccessType] = useState<string>(props.accessType ?? "OPEN");
  const [meetingUri, setMeetingUri] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[create-space] accessType=${accessType}`);
      const stdout = await execGws(
        `meet spaces create --json '${JSON.stringify({ config: { accessType } })}'`,
        meetToken()
      );
      logger.info(`[create-space] completed`);
      const data = JSON.parse(stdout) as SpaceResponse;
      setMeetingUri(data.meetingUri ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[create-space] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Create Meet Space" iconBundleId="com.google.drivefs" />
  );

  if (meetingUri) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.CopyToClipboard content={meetingUri} title="Copy Link" style="secondary" />
            <Action title="Done" onAction={() => closeWidget(`Meeting space created. Join: ${meetingUri}`)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown="Meeting space created successfully." />
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
            title={isLoading ? "Creating…" : "Create Space"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown
        name="accessType"
        label="Access Type"
        value={accessType}
        onChange={setAccessType}
      >
        {ACCESS_OPTIONS.map((o) => (
          <Form.Dropdown.Item key={o.value} title={o.label} value={o.value} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

const MeetCreateSpaceWidget = defineWidget({
  name: "meet-create-space",
  description: "Create a new Google Meet meeting space",
  schema,
  component: MeetCreateSpace,
});

export default MeetCreateSpaceWidget;
