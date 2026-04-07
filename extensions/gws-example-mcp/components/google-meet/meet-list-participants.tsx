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
  conferenceRecordId: z
    .string()
    .optional()
    .describe("ID of the conference record, e.g. conferenceRecords/abc123."),
});

type Props = z.infer<typeof schema>;

interface Participant {
  name?: string;
  earliestStartTime?: string;
  latestEndTime?: string;
  signedinUser?: { displayName?: string; user?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
}

function getDisplayName(p: Participant): string {
  return (
    p.signedinUser?.displayName ??
    p.anonymousUser?.displayName ??
    p.phoneUser?.displayName ??
    "Unknown"
  );
}

function formatParticipants(participants: Participant[]): string {
  if (participants.length === 0) return "_No participants found._";
  const rows = participants.map((p) => {
    const name = getDisplayName(p);
    const joined = p.earliestStartTime ? new Date(p.earliestStartTime).toLocaleString() : "—";
    const left = p.latestEndTime ? new Date(p.latestEndTime).toLocaleString() : "—";
    return `| ${name} | ${joined} | ${left} |`;
  });
  return [
    `**${participants.length} participant(s)**\n`,
    "| Name | Joined | Left |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function MeetListParticipants(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { records, isLoading: isLoadingRecords, error: recordsError } = useConferenceRecords();
  const [selectedRecord, setSelectedRecord] = useState(props.conferenceRecordId ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!selectedRecord) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[list-participants] parent=${selectedRecord}`);
      const stdout = await execGws(
        `meet conferenceRecords participants list --params '${JSON.stringify({ parent: selectedRecord })}'`,
        meetToken(),
        logger
      );
      logger.info(`[list-participants] completed`);
      const data = JSON.parse(stdout) as { participants?: Participant[] };
      setResult(formatParticipants(data.participants ?? []));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[list-participants] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="List Meet Participants" iconBundleId="com.google.drivefs" />
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
            title={isLoading ? "Fetching…" : "List Participants"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedRecord}
          />
        </ActionPanel>
      }
    >
      {recordsError && <Paper markdown={`**Error loading conferences:** ${recordsError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown
        name="conferenceRecordId"
        label="Conference"
        value={selectedRecord}
        onChange={setSelectedRecord}
      >
        {isLoadingRecords
          ? [<Form.Dropdown.Item key="loading" title="Loading conferences…" value="" />]
          : records.map((r) => {
              const label = r.startTime
                ? `${r.name} — ${new Date(r.startTime).toLocaleString()}`
                : r.name;
              return <Form.Dropdown.Item key={r.name} title={label} value={r.name} />;
            })}
      </Form.Dropdown>
    </Form>
  );
}

const MeetListParticipantsWidget = defineWidget({
  name: "meet-list-participants",
  description: "List participants of a Google Meet conference",
  schema,
  component: MeetListParticipants,
});

export default MeetListParticipantsWidget;
