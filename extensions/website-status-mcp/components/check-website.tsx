import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  url: z.string().optional().describe("The URL to probe. Schemes default to https:// when omitted."),
});

type Props = z.infer<typeof schema>;

interface ProbeResult {
  finalUrl: string;
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  contentType: string;
  server: string;
}

interface ProbeError {
  error: string;
  durationMs: number;
}

const TIMEOUT_MS = 10_000;

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function probe(url: string): Promise<ProbeResult | ProbeError> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      }
    } catch {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    const durationMs = Date.now() - start;
    return {
      finalUrl: res.url,
      status: res.status,
      statusText: res.statusText || "",
      ok: res.ok,
      durationMs,
      contentType: res.headers.get("content-type") ?? "",
      server: res.headers.get("server") ?? "",
    };
  } catch (e) {
    const durationMs = Date.now() - start;
    const reason = e instanceof Error ? e.message : String(e);
    return { error: controller.signal.aborted ? `Timed out after ${TIMEOUT_MS}ms` : reason, durationMs };
  } finally {
    clearTimeout(timeout);
  }
}

function isError(r: ProbeResult | ProbeError): r is ProbeError {
  return "error" in r;
}

function CheckWebsite(props: Props) {
  const closeWidget = useCloseWidget();
  const [url, setUrl] = useState(props.url ?? "");
  const [result, setResult] = useState<ProbeResult | ProbeError | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function onSubmit() {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    setIsChecking(true);
    setResult(null);
    try {
      setResult(await probe(normalized));
    } finally {
      setIsChecking(false);
    }
  }

  function onDone() {
    if (!result) closeWidget("Check cancelled.");
    else if (isError(result)) closeWidget(`Unreachable: ${result.error}`);
    else closeWidget(`${result.ok ? "OK" : "Status"} ${result.status} in ${result.durationMs}ms.`);
  }

  return (
    <Form
      header={<CardHeader title="Website Status" iconBundleId="com.apple.Safari" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isChecking ? "Checking..." : "Check"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isChecking}
            isDisabled={!url.trim()}
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="url" label="URL" value={url} onChange={setUrl} />
      {result && isError(result) && (
        <Paper
          markdown={[
            `### ❌ Unreachable`,
            "",
            `\`${result.error}\``,
            "",
            `_Failed after ${result.durationMs}ms._`,
          ].join("\n")}
        />
      )}
      {result && !isError(result) && (
        <Paper
          markdown={[
            `### ${result.ok ? "✅ Reachable" : "⚠️ Reached"} — ${result.status} ${result.statusText}`,
            "",
            "| | |",
            "|---|---|",
            `| **Final URL** | \`${result.finalUrl}\` |`,
            `| **Response time** | ${result.durationMs} ms |`,
            result.contentType ? `| **Content-Type** | \`${result.contentType}\` |` : "",
            result.server ? `| **Server** | \`${result.server}\` |` : "",
          ]
            .filter(Boolean)
            .join("\n")}
        />
      )}
    </Form>
  );
}

const CheckWebsiteWidget = defineWidget({
  name: "check-website",
  description:
    "Probe a URL with HEAD (falling back to GET on 405/501 or transport errors) and report status, redirect-followed final URL, response time, content-type, and server header. 10-second timeout.",
  schema,
  component: CheckWebsite,
});

export default CheckWebsiteWidget;
