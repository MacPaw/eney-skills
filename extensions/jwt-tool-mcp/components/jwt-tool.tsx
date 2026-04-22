import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import {
  SignJWT,
  decodeJwt,
  decodeProtectedHeader,
  importPKCS8,
  importSPKI,
  jwtVerify,
  type JWTPayload,
} from "jose";

const schema = z.object({
  token: z.string().optional().describe("The JWT token to decode and verify."),
  secret: z.string().optional().describe("The secret or public key for signature verification."),
});

type Props = z.infer<typeof schema>;

function tryDecode(raw: string): { header: string; payload: string } | null {
  try {
    const header = decodeProtectedHeader(raw.trim());
    const payload = decodeJwt(raw.trim());
    return {
      header: JSON.stringify(header),
      payload: JSON.stringify(payload),
    };
  } catch {
    return null;
  }
}

function reencodeUnsigned(
  headerJson: string,
  payloadJson: string,
  existingToken: string
): { token: string; error: string } {
  try {
    const header = JSON.parse(headerJson) as Record<string, unknown>;
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const originalSig = existingToken.split(".")[2] ?? "";
    return { token: `${headerB64}.${payloadB64}.${originalSig}`, error: "" };
  } catch (e) {
    return { token: "", error: e instanceof Error ? e.message : String(e) };
  }
}

async function importSignKey(secret: string, alg: string): Promise<CryptoKey | Uint8Array> {
  if (secret.includes("-----BEGIN")) return importPKCS8(secret, alg);
  return new TextEncoder().encode(secret);
}

async function importVerifyKey(secret: string, alg: string): Promise<CryptoKey | Uint8Array> {
  if (secret.includes("-----BEGIN")) {
    try { return await importSPKI(secret, alg); } catch { /* fall through */ }
    return importPKCS8(secret, alg);
  }
  return new TextEncoder().encode(secret);
}

function JwtTool(props: Props) {
  const closeWidget = useCloseWidget();

  const initialDecoded = props.token ? tryDecode(props.token) : null;

  const [token, setToken] = useState(props.token ?? "");
  const [headerJson, setHeaderJson] = useState(initialDecoded?.header ?? "");
  const [payloadJson, setPayloadJson] = useState(initialDecoded?.payload ?? "");
  const [secret, setSecret] = useState(props.secret ?? "");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  function handleTokenChange(val: string) {
    setToken(val);
    setError("");
    setStatus("");
    const decoded = tryDecode(val);
    if (decoded) {
      setHeaderJson(decoded.header);
      setPayloadJson(decoded.payload);
    } else if (!val.trim()) {
      setHeaderJson("");
      setPayloadJson("");
    }
  }

  function handleHeaderChange(val: string) {
    setHeaderJson(val);
    setError("");
    setStatus("");
    const { token: t, error: e } = reencodeUnsigned(val, payloadJson, token);
    if (t) setToken(t);
    else if (e && val.trim()) setError(e);
  }

  function handlePayloadChange(val: string) {
    setPayloadJson(val);
    setError("");
    setStatus("");
    const { token: t, error: e } = reencodeUnsigned(headerJson, val, token);
    if (t) setToken(t);
    else if (e && val.trim()) setError(e);
  }

  function handleSecretChange(val: string) {
    setSecret(val);
    setStatus("");
  }

  async function onSign() {
    setError("");
    setStatus("");
    setIsSigning(true);
    try {
      const header = JSON.parse(headerJson) as Record<string, string>;
      const payload = JSON.parse(payloadJson) as JWTPayload;
      const alg = header.alg ?? "HS256";
      const key = await importSignKey(secret, alg);
      const newToken = await new SignJWT(payload)
        .setProtectedHeader({ alg, ...(header.typ && { typ: header.typ }) })
        .sign(key);
      setToken(newToken);
      setStatus("✅ Token signed successfully");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSigning(false);
    }
  }

  async function onCheckSignature() {
    setError("");
    setStatus("");
    setIsChecking(true);
    try {
      const header = decodeProtectedHeader(token);
      const alg = (header.alg as string) ?? "HS256";
      const key = await importVerifyKey(secret, alg);
      await jwtVerify(token, key);
      setStatus("✅ Signature valid");
    } catch (e) {
      setStatus(`❌ Signature invalid — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsChecking(false);
    }
  }

  const hasContent = !!(token || headerJson || payloadJson);
  const canSign = !!(headerJson && payloadJson && secret);
  const canCheck = !!(token && secret);

  return (
    <Form
      header={<CardHeader title="JWT Tool" iconBundleId="" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title="Sign"
            onAction={onSign}
            style="secondary"
            isDisabled={!canSign}
            isLoading={isSigning}
          />
          <Action
            title="Check Signature"
            onAction={onCheckSignature}
            style="secondary"
            isDisabled={!canCheck}
            isLoading={isChecking}
          />
          <Action title="Done" onAction={() => closeWidget("Done.")} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField
        name="token"
        label="Encoded JWT"
        value={token}
        onChange={handleTokenChange}
        isCopyable
      />
      {hasContent && (
        <Form.TextField
          name="header"
          label="Header (JSON)"
          value={headerJson}
          onChange={handleHeaderChange}
          isCopyable
        />
      )}
      {hasContent && (
        <Form.TextField
          name="payload"
          label="Payload (JSON)"
          value={payloadJson}
          onChange={handlePayloadChange}
          isCopyable
        />
      )}
      <Form.TextField
        name="secret"
        label="Secret / Public Key"
        value={secret}
        onChange={handleSecretChange}
      />
      <Paper markdown={error ? `**Error:** ${error}` : status || "\u00a0"} />
    </Form>
  );
}

const JwtToolWidget = defineWidget({
  name: "jwt-tool",
  description: "Decode, verify, and sign JSON Web Tokens (JWT) — a clone of jwt.io",
  schema,
  component: JwtTool,
});

export default JwtToolWidget;
