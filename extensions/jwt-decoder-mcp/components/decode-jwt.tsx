import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  token: z.string().optional().describe("The JWT to decode."),
});

type Props = z.infer<typeof schema>;

interface Decoded {
  header: unknown;
  payload: unknown;
  signature: string;
}

const TIME_CLAIMS = new Set(["exp", "iat", "nbf", "auth_time"]);

function decodeSegment(segment: string): unknown {
  const json = Buffer.from(segment, "base64url").toString("utf8");
  return JSON.parse(json);
}

function decode(token: string): Decoded | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    return {
      header: decodeSegment(parts[0]),
      payload: decodeSegment(parts[1]),
      signature: parts[2],
    };
  } catch {
    return null;
  }
}

function formatTimeClaim(value: unknown): string {
  if (typeof value !== "number") return JSON.stringify(value);
  const ms = value > 1e12 ? value : value * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return JSON.stringify(value);
  return `${value} _(${d.toISOString()})_`;
}

function renderClaims(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "```\n" + JSON.stringify(payload, null, 2) + "\n```";
  const entries = Object.entries(payload as Record<string, unknown>);
  const lines: string[] = [];
  lines.push("| Claim | Value |");
  lines.push("|---|---|");
  for (const [key, value] of entries) {
    const formatted = TIME_CLAIMS.has(key)
      ? formatTimeClaim(value)
      : "`" + JSON.stringify(value) + "`";
    lines.push(`| **${key}** | ${formatted} |`);
  }
  return lines.join("\n");
}

function DecodeJwt(props: Props) {
  const closeWidget = useCloseWidget();
  const [token, setToken] = useState(props.token ?? "");

  const decoded = token.trim() ? decode(token) : null;

  function onDone() {
    if (!decoded) closeWidget("No JWT decoded.");
    else closeWidget("JWT decoded.");
  }

  return (
    <Form
      header={<CardHeader title="Decode JWT" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {decoded && <Action.CopyToClipboard title="Copy payload" content={JSON.stringify(decoded.payload, null, 2)} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="token" label="JWT" value={token} onChange={setToken} />
      {!decoded && token.trim() && <Paper markdown="_Could not decode — expected three base64url segments separated by dots._" />}
      {decoded && (
        <Paper
          markdown={[
            "### Header",
            "```json",
            JSON.stringify(decoded.header, null, 2),
            "```",
            "",
            "### Payload",
            renderClaims(decoded.payload),
            "",
            "### Signature",
            "`" + decoded.signature + "`",
            "",
            "_Signature is not verified — display only._",
          ].join("\n")}
        />
      )}
    </Form>
  );
}

const DecodeJwtWidget = defineWidget({
  name: "decode-jwt",
  description:
    "Decode a JSON Web Token to inspect its header and payload. Signature is NOT verified — display only.",
  schema,
  component: DecodeJwt,
});

export default DecodeJwtWidget;
