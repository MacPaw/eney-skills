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
});

type Props = z.infer<typeof schema>;

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
    `| **Entry Point Access** | ${data.config?.entryPointAccess ?? "—"} |`,
  ];
  return ["| Property | Value |", "| --- | --- |", ...rows].join("\n");
}

function MeetGetSpace(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { uniqueSpaces, isLoading: isLoadingSpaces, error: spacesError } = useConferenceRecords();
  const [selectedSpace, setSelectedSpace] = useState(props.spaceName ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!selectedSpace) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[get-space] name=${selectedSpace}`);
      const stdout = await execGws(
        `meet spaces get --params '${JSON.stringify({ name: selectedSpace })}'`,
        meetToken(),
        logger
      );
      logger.info(`[get-space] completed`);
      setResult(formatSpace(JSON.parse(stdout) as SpaceResponse));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[get-space] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Get Meet Space" iconBundleId="com.google.drivefs" />
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
            title={isLoading ? "Fetching…" : "Get Space"}
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
    </Form>
  );
}

const MeetGetSpaceWidget = defineWidget({
  name: "meet-get-space",
  description: "Get details about a Google Meet meeting space",
  schema,
  component: MeetGetSpace,
});

export default MeetGetSpaceWidget;
