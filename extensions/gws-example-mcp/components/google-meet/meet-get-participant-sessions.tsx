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
    .describe("Resource name of the conference record, e.g. conferenceRecords/abc123."),
  participantId: z
    .string()
    .optional()
    .describe("Resource name of the participant, e.g. conferenceRecords/abc123/participants/xyz."),
});

type Props = z.infer<typeof schema>;

interface Participant {
  name?: string;
  signedinUser?: { displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
}

interface ParticipantSession {
  name?: string;
  startTime?: string;
  endTime?: string;
}

function getDisplayName(p: Participant): string {
  return (
    p.signedinUser?.displayName ??
    p.anonymousUser?.displayName ??
    p.phoneUser?.displayName ??
    p.name ??
    "Unknown"
  );
}

function formatSessions(sessions: ParticipantSession[]): string {
  if (sessions.length === 0) return "_No sessions found._";
  const rows = sessions.map((s) => {
    const joined = s.startTime ? new Date(s.startTime).toLocaleString() : "—";
    const left = s.endTime ? new Date(s.endTime).toLocaleString() : "still active";
    return `| \`${s.name ?? "—"}\` | ${joined} | ${left} |`;
  });
  return [
    `**${sessions.length} session(s)**\n`,
    "| Session | Joined | Left |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function MeetGetParticipantSessions(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { records, isLoading: isLoadingRecords, error: recordsError } = useConferenceRecords();
  const [selectedRecord, setSelectedRecord] = useState(props.conferenceRecordId ?? "");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(props.participantId ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadParticipants(parent: string) {
    if (!parent) return;
    setIsLoadingParticipants(true);
    setParticipants([]);
    setSelectedParticipant("");
    try {
      const stdout = await execGws(
        `meet conferenceRecords participants list --params '${JSON.stringify({ parent })}'`,
        meetToken(),
        logger
      );
      const data = JSON.parse(stdout) as { participants?: Participant[] };
      setParticipants(data.participants ?? []);
    } catch (e) {
      logger.error(`[get-sessions] load participants error=${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoadingParticipants(false);
    }
  }

  function onConferenceChange(val: string) {
    setSelectedRecord(val);
    void loadParticipants(val);
  }

  async function onSubmit() {
    if (!selectedParticipant) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[get-sessions] parent=${selectedParticipant}`);
      const stdout = await execGws(
        `meet conferenceRecords participants participantSessions list --params '${JSON.stringify({ parent: selectedParticipant })}'`,
        meetToken(),
        logger
      );
      logger.info(`[get-sessions] completed`);
      const data = JSON.parse(stdout) as { participantSessions?: ParticipantSession[] };
      setResult(formatSessions(data.participantSessions ?? []));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[get-sessions] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Participant Sessions" iconBundleId="com.google.drivefs" />
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
            title={isLoading ? "Fetching…" : "Get Sessions"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedParticipant}
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
        onChange={onConferenceChange}
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
      <Form.Dropdown
        name="participantId"
        label="Participant"
        value={selectedParticipant}
        onChange={setSelectedParticipant}
      >
        {isLoadingParticipants
          ? [<Form.Dropdown.Item key="loading" title="Loading participants…" value="" />]
          : participants.length === 0
          ? [<Form.Dropdown.Item key="empty" title="Select a conference first" value="" />]
          : participants.map((p) => (
              <Form.Dropdown.Item key={p.name} title={getDisplayName(p)} value={p.name ?? ""} />
            ))}
      </Form.Dropdown>
    </Form>
  );
}

const MeetGetParticipantSessionsWidget = defineWidget({
  name: "meet-get-participant-sessions",
  description: "Get session details for a participant in a Google Meet conference",
  schema,
  component: MeetGetParticipantSessions,
});

export default MeetGetParticipantSessionsWidget;
