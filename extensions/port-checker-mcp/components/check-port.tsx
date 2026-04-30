import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { Socket } from "node:net";

const schema = z.object({
  host: z.string().optional().describe("Hostname or IP, e.g. 'example.com' or '127.0.0.1'."),
  port: z.number().int().optional().describe("TCP port number (1-65535)."),
  timeoutMs: z.number().int().optional().describe("Connection timeout in milliseconds. Defaults to 3000."),
});

type Props = z.infer<typeof schema>;

interface ProbeResult {
  ok: boolean;
  durationMs: number;
  error: string;
}

async function probePort(host: string, port: number, timeoutMs: number): Promise<ProbeResult> {
  return await new Promise((resolve) => {
    const start = Date.now();
    const socket = new Socket();
    let settled = false;
    const settle = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => settle({ ok: true, durationMs: Date.now() - start, error: "" }));
    socket.once("timeout", () => settle({ ok: false, durationMs: Date.now() - start, error: `Timed out after ${timeoutMs}ms` }));
    socket.once("error", (err) => settle({ ok: false, durationMs: Date.now() - start, error: err.message }));
    socket.connect(port, host);
  });
}

const COMMON_PORTS: Record<number, string> = {
  22: "SSH",
  25: "SMTP",
  53: "DNS",
  80: "HTTP",
  110: "POP3",
  143: "IMAP",
  443: "HTTPS",
  465: "SMTPS",
  587: "Submission",
  993: "IMAPS",
  995: "POP3S",
  3306: "MySQL",
  3389: "RDP",
  5432: "PostgreSQL",
  5900: "VNC",
  6379: "Redis",
  8080: "HTTP-alt",
  8443: "HTTPS-alt",
  27017: "MongoDB",
};

function CheckPort(props: Props) {
  const closeWidget = useCloseWidget();
  const [host, setHost] = useState(props.host ?? "");
  const [port, setPort] = useState<number | null>(props.port ?? 443);
  const [timeoutMs, setTimeoutMs] = useState<number | null>(props.timeoutMs ?? 3000);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function onSubmit() {
    if (!host.trim() || !port || port < 1 || port > 65535) return;
    setIsChecking(true);
    setResult(null);
    try {
      setResult(await probePort(host.trim(), port, Math.max(100, timeoutMs ?? 3000)));
    } finally {
      setIsChecking(false);
    }
  }

  function onDone() {
    if (!result) closeWidget("Probe cancelled.");
    else if (result.ok) closeWidget(`${host}:${port} is open (${result.durationMs}ms).`);
    else closeWidget(`${host}:${port} is closed: ${result.error}`);
  }

  const serviceLabel = port ? COMMON_PORTS[port] : null;

  return (
    <Form
      header={<CardHeader title="Port Checker" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isChecking ? "Checking..." : "Check"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isChecking}
            isDisabled={!host.trim() || !port}
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="host" label="Host" value={host} onChange={setHost} />
      <Form.NumberField name="port" label="Port" value={port} onChange={setPort} min={1} max={65535} />
      <Form.NumberField name="timeoutMs" label="Timeout (ms)" value={timeoutMs} onChange={setTimeoutMs} min={100} max={30000} />
      {serviceLabel && <Paper markdown={`_Port ${port} is commonly **${serviceLabel}**._`} />}
      {result && result.ok && (
        <Paper markdown={`### ✅ Open\n\nConnected in ${result.durationMs} ms.`} />
      )}
      {result && !result.ok && (
        <Paper markdown={`### ❌ Closed / unreachable\n\n\`${result.error}\` _(after ${result.durationMs} ms)_`} />
      )}
    </Form>
  );
}

const CheckPortWidget = defineWidget({
  name: "check-port",
  description:
    "Check whether a TCP port is open on a host by attempting a TCP connect via Node's net.Socket. Configurable timeout (100-30000ms). Common port numbers (22, 80, 443, 3306, etc.) are annotated with their well-known service.",
  schema,
  component: CheckPort,
});

export default CheckPortWidget;
