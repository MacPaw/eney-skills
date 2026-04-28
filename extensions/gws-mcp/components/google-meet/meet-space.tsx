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
  useCloseWidget,
  useLogger,
} from "@eney/api";
import { execGws, meetToken, parseGwsError } from "../../helpers/gws.js";
import { useConferenceRecords } from "../../helpers/use-conference-records.js";

const schema = z.object({
  spaceName: z.string().optional().describe("Resource name of the Meet space, e.g. spaces/abc123."),
  accessType: z
    .enum(["OPEN", "TRUSTED", "RESTRICTED"])
    .optional()
    .describe("Access type to set for the space."),
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
    `| **Meeting Code** | \`${data.meetingCode ?? "—"}\` |`,
    `| **Space Name** | \`${data.name ?? "—"}\` |`,
    `| **Entry Point Access** | ${data.config?.entryPointAccess ?? "—"} |`,
  ];
  return ["| Property | Value |", "| --- | --- |", ...rows].join("\n");
}

function MeetSpace(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { uniqueSpaces, isLoading: isLoadingSpaces, error: spacesError } = useConferenceRecords();

  const [selectedSpace, setSelectedSpace] = useState(props.spaceName ?? "");
  const [meetingUri, setMeetingUri] = useState("");
  const [accessType, setAccessType] = useState<string>(props.accessType ?? "OPEN");
  const [originalAccessType, setOriginalAccessType] = useState("");
  const [spaceInfo, setSpaceInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (selectedSpace) void loadSpace(selectedSpace);
  }, [selectedSpace]);

  async function loadSpace(name: string) {
    setIsLoading(true);
    setError("");
    setInfo("");
    setSpaceInfo("");
    setMeetingUri("");
    try {
      logger.info(`[meet-space] get name=${name}`);
      const stdout = await execGws(
        ["meet", "spaces", "get", "--params", JSON.stringify({ name })],
        meetToken()
      );
      const data = JSON.parse(stdout) as SpaceResponse;
      const currentAccessType = data.config?.accessType ?? "OPEN";
      setMeetingUri(data.meetingUri ?? "");
      setAccessType(currentAccessType);
      setOriginalAccessType(currentAccessType);
      setSpaceInfo(formatSpace(data));
    } catch (e) {
      const msg = parseGwsError(e);
      logger.error(`[meet-space] get error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function onUpdate() {
    if (!selectedSpace) return;
    setIsUpdating(true);
    setError("");
    setInfo("");
    try {
      logger.info(`[meet-space] update name=${selectedSpace} accessType=${accessType}`);
      const stdout = await execGws(
        ["meet", "spaces", "patch", "--params", JSON.stringify({ name: selectedSpace, updateMask: "config.accessType" }), "--json", JSON.stringify({ config: { accessType } })],
        meetToken()
      );
      const data = JSON.parse(stdout) as SpaceResponse;
      const updated = data.config?.accessType ?? accessType;
      setOriginalAccessType(updated);
      setInfo(`Access type updated to ${updated}.`);
    } catch (e) {
      const msg = parseGwsError(e);
      logger.error(`[meet-space] update error=${msg}`);
      setError(msg);
    } finally {
      setIsUpdating(false);
    }
  }

  const header = <CardHeader title="Meet Space" iconBundleId="com.google.drivefs" />;
  const accessTypeChanged = accessType !== originalAccessType;

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Divider />
          <ActionPanel layout="row">
            <Action.CopyToClipboard
              content={meetingUri}
              title="Copy Link"
              style="secondary"
              isDisabled={!meetingUri}
            />
            <Action
              title={isUpdating ? "Updating…" : "Update"}
              onAction={onUpdate}
              style="secondary"
              isLoading={isUpdating}
              isDisabled={!accessTypeChanged || !selectedSpace || isLoading}
            />
            <Action
              title="Done"
              onAction={() => closeWidget(meetingUri || selectedSpace)}
              style="primary"
            />
          </ActionPanel>
        </ActionPanel>
      }
    >
      {spacesError && <Paper markdown={`**Error loading spaces:** ${spacesError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {info && <Paper markdown={info} />}
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
      {spaceInfo && (
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
      )}
      {isLoading && <Paper markdown="_Loading space details…_" />}
      {spaceInfo && <Paper markdown={spaceInfo} />}
    </Form>
  );
}

const MeetSpaceWidget = defineWidget({
  name: "meet-space",
  description: "View details and update the access type of a Google Meet space",
  schema,
  component: MeetSpace,
});

export default MeetSpaceWidget;
