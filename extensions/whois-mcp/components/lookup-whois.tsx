import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { SummaryRow, runWhois, summarize } from "../helpers/whois.js";

const schema = z.object({
  domain: z.string().optional().describe("The domain (or IP) to look up, e.g. 'example.com'."),
});

type Props = z.infer<typeof schema>;

interface LookupResult {
  summary: SummaryRow[];
  raw: string;
}

function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0];
  return d;
}

function LookupWhois(props: Props) {
  const closeWidget = useCloseWidget();
  const [domain, setDomain] = useState(props.domain ?? "");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [isLooking, setIsLooking] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    const target = normalizeDomain(domain);
    if (!target) return;
    setIsLooking(true);
    setError("");
    setResult(null);
    try {
      const r = await runWhois(target);
      setResult({ summary: summarize(r.fields), raw: r.raw });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLooking(false);
    }
  }

  function onDone() {
    if (!result) closeWidget("Lookup cancelled.");
    else closeWidget(`Whois for ${normalizeDomain(domain)} retrieved.`);
  }

  const summaryLines: string[] = [];
  if (result) {
    if (!result.summary.length) {
      summaryLines.push("_No structured fields recognized — see raw response below._");
    } else {
      summaryLines.push("| Field | Value |");
      summaryLines.push("|---|---|");
      for (const row of result.summary) {
        const value = row.values.length === 1 ? `\`${row.values[0]}\`` : row.values.map((v) => `\`${v}\``).join("<br>");
        summaryLines.push(`| **${row.label}** | ${value} |`);
      }
    }
  }

  return (
    <Form
      header={<CardHeader title="Whois" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isLooking ? "Looking up..." : "Lookup"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLooking}
            isDisabled={!domain.trim()}
          />
          {result && <Action.CopyToClipboard title="Copy raw" content={result.raw} />}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="domain" label="Domain" value={domain} onChange={setDomain} />
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {result && <Paper markdown={summaryLines.join("\n")} />}
      {result && (
        <Form.Checkbox name="showRaw" label="Show raw response" checked={showRaw} onChange={setShowRaw} variant="switch" />
      )}
      {result && showRaw && <Paper markdown={"```\n" + result.raw + "\n```"} />}
    </Form>
  );
}

const LookupWhoisWidget = defineWidget({
  name: "lookup-whois",
  description:
    "Look up domain registration info via the system `whois` CLI. Renders a summary of registrar, creation/update/expiry dates, status flags, and name servers; raw response is available behind a toggle.",
  schema,
  component: LookupWhois,
});

export default LookupWhoisWidget;
