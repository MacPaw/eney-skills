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
import { useConferenceRecords } from "../../helpers/use-conference-records.js";

const schema = z.object({
  spaceName: z.string().optional().describe("Resource name of the Meet space, e.g. spaces/abc123."),
  accessType: z
    .enum(["OPEN", "TRUSTED", "RESTRICTED"])
    .optional()
    .describe("New access type for the space."),
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
  config?: { accessType?: string; entryPointAccess?: string };
}

function formatSpace(data: SpaceResponse): string {
  const rows = [
    `| **Meeting URI** | ${data.meetingUri ? `[Join](${data.meetingUri})` : "—"} |`,
    `| **Meeting Code** | \`${data.meetingCode ?? "—"}\` |`,
    `| **Space Name** | \`${data.name ?? "—"}\` |`,
    `| **Access Type** | ${data.config?.accessType ?? "—"} |`,
  ];
  return ["| Property | Value |", "| --- | --- |", ...rows].join("\n");
}

function MeetUpdateSpace(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { uniqueSpaces, isLoading: isLoadingSpaces, error: spacesError } = useConferenceRecords();
  const [selectedSpace, setSelectedSpace] = useState(props.spaceName ?? "");
  const [accessType, setAccessType] = useState<string>(props.accessType ?? "OPEN");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!selectedSpace) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[update-space] name=${selectedSpace} accessType=${accessType}`);
      const stdout = await execGws(
        `meet spaces patch --params '${JSON.stringify({ name: selectedSpace, updateMask: "config.accessType" })}' --json '${JSON.stringify({ config: { accessType } })}'`,
        meetToken(),
        logger
      );
      logger.info(`[update-space] completed`);
      setResult(formatSpace(JSON.parse(stdout) as SpaceResponse));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[update-space] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Update Meet Space" iconBundleId="com.google.drivefs" />
  );

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Update Another" onSubmit={() => setResult("")} style="secondary" />
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
            title={isLoading ? "Updating…" : "Update Space"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedSpace}
          />
        </ActionPanel>
      }
    >
      {spacesError && <Paper markdown={`**Error loading spaces:** ${spacesError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown
        name="spaceName"
        label="Space"
        value={selectedSpace}
        onChange={setSelectedSpace}
      >
        {isLoadingSpaces
          ? [<Form.Dropdown.Item key="loading" title="Loading spaces…" value="" />]
          : uniqueSpaces.map((s) => (
              <Form.Dropdown.Item key={s} title={s} value={s} />
            ))}
      </Form.Dropdown>
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

const MeetUpdateSpaceWidget = defineWidget({
  name: "meet-update-space",
  description: "Update the configuration of a Google Meet meeting space",
  schema,
  component: MeetUpdateSpace,
});

export default MeetUpdateSpaceWidget;
