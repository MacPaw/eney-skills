import { useState } from "react";
import { spawn } from "node:child_process";
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

// ─── Shell helper ──────────────────────────────────────────────────────
async function run(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("error", () => resolve({ stdout, stderr, code: 1 }));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

// ─── Flags decoder ─────────────────────────────────────────────────────
const FLAG_MAP: [number, string][] = [
  [0x0002, "adhoc"],
  [0x0100, "hard"],
  [0x0200, "kill"],
  [0x0400, "expires"],
  [0x0800, "restrict"],
  [0x1000, "enforcement"],
  [0x2000, "library-validation"],
  [0x10000, "runtime"],
  [0x20000, "linker-signed"],
];

function decodeFlags(raw: string): string[] {
  const m = raw.match(/0x([0-9a-fA-F]+)/);
  if (!m) return [];
  const val = parseInt(m[1], 16);
  return FLAG_MAP.filter(([f]) => val & f).map(([, name]) => name);
}

// ─── Parsers ───────────────────────────────────────────────────────────
function field(text: string, key: string): string {
  const line = text.split("\n").find((l) => l.trimStart().startsWith(key + "="));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

function allFields(text: string, key: string): string[] {
  return text
    .split("\n")
    .filter((l) => l.trimStart().startsWith(key + "="))
    .map((l) => l.slice(l.indexOf("=") + 1).trim());
}

function parseEntitlements(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const keyRe = /<key>([^<]+)<\/key>\s*(<[^/][^>]*\/>|<[^/][^>]*>[^<]*<\/[^>]+>)/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(xml)) !== null) {
    const key = m[1].trim();
    const valTag = m[2];
    let val = "true";
    if (valTag.startsWith("<false")) val = "false";
    else if (valTag.startsWith("<integer>")) val = valTag.replace(/<\/?integer>/g, "");
    else if (valTag.startsWith("<string>")) val = valTag.replace(/<\/?string>/g, "");
    else if (valTag.startsWith("<array")) val = "[ array ]";
    result[key] = val;
  }
  return result;
}

// ─── Main analyser ─────────────────────────────────────────────────────
interface SigningReport {
  appName: string;
  identifier: string;
  format: string;
  teamIdentifier: string;
  authorities: string[];
  flagsRaw: string;
  flagsDecoded: string[];
  cdHash: string;
  signatureSize: string;
  timestamp: string;
  signedTime: string;
  runtimeVersion: string;
  sealedFiles: string;
  gatekeeperVerdict: string;
  gatekeeperSource: string;
  gatekeeperOrigin: string;
  stapleStatus: string;
  entitlements: Record<string, string>;
  isSigned: boolean;
  rawCodesign: string;
}

async function analyzeApp(path: string): Promise<SigningReport> {
  const appName = path.split("/").pop() ?? path;

  // Run all commands in parallel
  const [cs, spctl, stapler, ent] = await Promise.all([
    run("codesign", ["-dvvv", path]),
    run("spctl", ["--assess", "-a", "-vvv", "--type", "exec", path]),
    run("xcrun", ["stapler", "validate", path]),
    run("codesign", ["-d", "--entitlements", ":-", path]),
  ]);

  // codesign -dvvv writes everything to stderr
  const csOut = cs.stderr + cs.stdout;
  const isSigned = !csOut.includes("code object is not signed") && cs.code !== 1;

  // spctl also writes to stderr
  const spctlOut = spctl.stderr + spctl.stdout;

  // Parse codesign fields
  const identifier = field(csOut, "Identifier");
  const format = field(csOut, "Format");
  const teamIdentifier = field(csOut, "TeamIdentifier");
  const authorities = allFields(csOut, "Authority");
  const runtimeVersion = field(csOut, "Runtime Version");
  const cdHash = field(csOut, "CDHash");
  const signatureSize = field(csOut, "Signature size");
  const timestamp = field(csOut, "Timestamp");
  const signedTime = field(csOut, "Signed Time");

  // Flags
  const cdLine = csOut.split("\n").find((l) => l.includes("flags=")) ?? "";
  const flagsMatch = cdLine.match(/flags=(\S+)/);
  const flagsRaw = flagsMatch ? flagsMatch[1] : "";
  const flagsDecoded = decodeFlags(flagsRaw);

  // Sealed resources
  const sealedLine = csOut.split("\n").find((l) => l.includes("Sealed Resources")) ?? "";
  const sealedMatch = sealedLine.match(/files=(\d+)/);
  const sealedFiles = sealedMatch ? sealedMatch[1] : "";

  // Gatekeeper (spctl)
  const verdictLine = spctlOut.split("\n").find((l) => l.includes(": ")) ?? "";
  const gatekeeperVerdict = verdictLine.includes("accepted")
    ? "accepted"
    : verdictLine.includes("rejected")
      ? "rejected"
      : spctl.code === 0
        ? "accepted"
        : "unknown";
  const gatekeeperSource = field(spctlOut, "source");
  const gatekeeperOrigin = field(spctlOut, "origin");

  // Notarization staple
  const stapleOut = stapler.stdout + stapler.stderr;
  const stapleStatus = stapleOut.includes("worked") || stapleOut.includes("valid")
    ? "stapled ✅"
    : stapleOut.includes("not have a ticket")
      ? "not stapled"
      : stapler.code === 0
        ? "stapled ✅"
        : "not stapled";

  // Entitlements
  const entXml = ent.stdout + ent.stderr;
  const entitlements = entXml.includes("<?xml") ? parseEntitlements(entXml) : {};

  return {
    appName,
    identifier,
    format,
    teamIdentifier,
    authorities,
    flagsRaw,
    flagsDecoded,
    cdHash,
    signatureSize,
    timestamp,
    signedTime,
    runtimeVersion,
    sealedFiles,
    gatekeeperVerdict,
    gatekeeperSource,
    gatekeeperOrigin,
    stapleStatus,
    entitlements,
    isSigned,
    rawCodesign: csOut,
  };
}

// ─── Markdown formatter ────────────────────────────────────────────────
function buildReport(r: SigningReport): string {
  if (!r.isSigned) {
    return `## ❌ ${r.appName}\n\n**This binary is not code signed.**`;
  }

  const gkEmoji = r.gatekeeperVerdict === "accepted" ? "✅" : r.gatekeeperVerdict === "rejected" ? "❌" : "⚠️";
  const flagsList = r.flagsDecoded.length > 0
    ? r.flagsDecoded.map((f) => `\`${f}\``).join("  ")
    : "_none_";
  const certChain = r.authorities.length > 0
    ? r.authorities.map((a, i) => `${i + 1}. ${a}`).join("\n")
    : "_not available_";

  const entKeys = Object.keys(r.entitlements);
  const entSection = entKeys.length > 0
    ? `### 🔑 Entitlements (${entKeys.length})\n\n| Key | Value |\n|---|---|\n` +
      entKeys.map((k) => `| \`${k}\` | \`${r.entitlements[k]}\` |`).join("\n")
    : `### 🔑 Entitlements\n\n_None_`;

  return `## ${gkEmoji} ${r.appName}

| | |
|---|---|
| **Bundle ID** | \`${r.identifier || "—"}\` |
| **Format** | ${r.format || "—"} |
| **Team ID** | \`${r.teamIdentifier || "—"}\` |
| **Gatekeeper** | ${gkEmoji} ${r.gatekeeperVerdict} |
| **Source** | ${r.gatekeeperSource || "—"} |
| **Notarization** | ${r.stapleStatus} |

### 🔐 Certificate Chain

${certChain}

### 📋 Signature Details

| | |
|---|---|
| **Flags** | ${flagsList} |
| **CDHash** | \`${r.cdHash || "—"}\` |
| **Signature Size** | ${r.signatureSize ? r.signatureSize + " bytes" : "—"} |
| **Timestamp** | ${r.timestamp || r.signedTime || "—"} |
| **Runtime Version** | ${r.runtimeVersion || "—"} |
| **Sealed Files** | ${r.sealedFiles || "—"} |
| **Origin** | ${r.gatekeeperOrigin || "—"} |

${entSection}`;
}

// ─── Widget ────────────────────────────────────────────────────────────
const schema = z.object({
  path: z.string().optional().describe("Path to the .app, .pkg, or binary to verify."),
});

type Props = z.infer<typeof schema>;

function VerifySigning(props: Props) {
  const closeWidget = useCloseWidget();
  const [filePath, setFilePath] = useState(props.path ?? "");
  const [report, setReport] = useState<SigningReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onVerify() {
    if (!filePath) return;
    setIsLoading(true);
    setError("");
    setReport(null);
    try {
      const result = await analyzeApp(filePath);
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onReset() {
    setReport(null);
    setError("");
  }

  function onDone() {
    closeWidget(report ? `Verified: ${report.appName}` : "Done.");
  }

  // ── Results view ────────────────────────────────────────────────────
  if (report) {
    const markdown = buildReport(report);
    return (
      <Form
        header={<CardHeader title="Code Signing" iconBundleId="com.apple.keychainaccess" />}
        actions={
          <ActionPanel layout="row">
            <Action title="Verify Another" onAction={onReset} style="secondary" />
            <Action.CopyToClipboard content={markdown} title="Copy Report" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={markdown} isScrollable />
      </Form>
    );
  }

  // ── Input view ──────────────────────────────────────────────────────
  return (
    <Form
      header={<CardHeader title="Code Signing" iconBundleId="com.apple.keychainaccess" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isLoading ? "Analyzing…" : "Verify"}
            onSubmit={onVerify}
            style="primary"
            isLoading={isLoading}
            isDisabled={!filePath || isLoading}
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.FilePicker
        name="app"
        label="Application or Binary"
        value={filePath}
        onChange={setFilePath}
      />
    </Form>
  );
}

// ─── Registration ──────────────────────────────────────────────────────
const VerifySigningWidget = defineWidget({
  name: "verify-signing",
  description: "Verify macOS application code signing, certificates, entitlements, and notarization status",
  schema,
  component: VerifySigning,
});

export default VerifySigningWidget;
