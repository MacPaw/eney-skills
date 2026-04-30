import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { Resolver } from "node:dns/promises";

const RECORD_TYPES = ["A", "AAAA", "MX", "TXT", "CNAME", "NS"] as const;
type RecordType = (typeof RECORD_TYPES)[number];

const schema = z.object({
  hostname: z.string().optional().describe("The hostname to look up, e.g. example.com."),
  recordType: z.enum(RECORD_TYPES).optional().describe("DNS record type. Defaults to 'A'."),
});

type Props = z.infer<typeof schema>;

interface MxRecord {
  priority: number;
  exchange: string;
}

async function resolve(hostname: string, type: RecordType): Promise<string[]> {
  const resolver = new Resolver();
  switch (type) {
    case "A":
      return resolver.resolve4(hostname);
    case "AAAA":
      return resolver.resolve6(hostname);
    case "MX": {
      const records = (await resolver.resolveMx(hostname)) as MxRecord[];
      return records
        .sort((a, b) => a.priority - b.priority)
        .map((r) => `${r.priority} ${r.exchange}`);
    }
    case "TXT": {
      const records = await resolver.resolveTxt(hostname);
      return records.map((parts) => parts.join(""));
    }
    case "CNAME":
      return resolver.resolveCname(hostname);
    case "NS":
      return resolver.resolveNs(hostname);
  }
}

function LookupDns(props: Props) {
  const closeWidget = useCloseWidget();
  const [hostname, setHostname] = useState(props.hostname ?? "");
  const [recordType, setRecordType] = useState<RecordType>(props.recordType ?? "A");
  const [results, setResults] = useState<string[] | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    const trimmed = hostname.trim();
    if (!trimmed) return;
    setIsLooking(true);
    setError("");
    setResults(null);
    try {
      const records = await resolve(trimmed, recordType);
      setResults(records);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLooking(false);
    }
  }

  function onDone() {
    if (results === null) closeWidget("Lookup cancelled.");
    else closeWidget(`${results.length} ${recordType} record(s) for ${hostname}.`);
  }

  return (
    <Form
      header={<CardHeader title="DNS Lookup" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isLooking ? "Looking up..." : "Lookup"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLooking}
            isDisabled={!hostname.trim()}
          />
          {results && results.length > 0 && (
            <Action.CopyToClipboard title="Copy" content={results.join("\n")} />
          )}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="hostname" label="Hostname" value={hostname} onChange={setHostname} />
      <Form.Dropdown
        name="recordType"
        label="Record type"
        value={recordType}
        onChange={(v) => setRecordType(v as RecordType)}
      >
        {RECORD_TYPES.map((t) => (
          <Form.Dropdown.Item key={t} title={t} value={t} />
        ))}
      </Form.Dropdown>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {results && results.length > 0 && (
        <Paper
          markdown={
            `### ${recordType} records for ${hostname}\n\n` +
            results.map((r) => `- \`${r}\``).join("\n")
          }
        />
      )}
      {results && results.length === 0 && (
        <Paper markdown={`_No ${recordType} records found for **${hostname}**._`} />
      )}
    </Form>
  );
}

const LookupDnsWidget = defineWidget({
  name: "lookup-dns",
  description: "Look up DNS records for a hostname. Supports A, AAAA, MX, TXT, CNAME, and NS record types.",
  schema,
  component: LookupDns,
});

export default LookupDnsWidget;
