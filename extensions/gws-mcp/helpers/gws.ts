import { execFile } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chmodSync, existsSync } from "fs";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

const GWS_DIR = join(__dirname, "..", "node_modules", "@googleworkspace", "cli");
const GWS_SCRIPT = join(GWS_DIR, "run.js");
const GWS_BIN = join(GWS_DIR, "bin", "gws");

let prepared = false;

async function prepareBinary(): Promise<void> {
  if (prepared) return;
  prepared = true;
  if (process.platform !== "darwin") return;
  if (!existsSync(GWS_BIN)) return;
  try {
    await execFileAsync("/usr/bin/xattr", ["-c", GWS_BIN]);
  } catch {}
  try {
    chmodSync(GWS_BIN, 0o755);
  } catch {}
}

export async function execGws(args: string[], token?: string): Promise<string> {
  await prepareBinary();
  const { stdout } = await execFileAsync(process.execPath, [GWS_SCRIPT, ...args], {
    timeout: 30000,
    env: { ...process.env, GOOGLE_WORKSPACE_CLI_TOKEN: token ?? "" },
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export function driveToken(): string {
  return process.env.GOOGLE_DRIVE_TOKEN ?? "";
}

export function meetToken(): string {
  return process.env.GOOGLE_MEET_TOKEN ?? "";
}

export function tasksToken(): string {
  return process.env.GOOGLE_TASKS_TOKEN ?? "";
}

export function parseGwsError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const match = msg.match(/error\[[^\]]+\]:\s*(.+)$/s);
  if (match) return match[1].trim();
  const lines = msg.split("\n").filter((l) => l.trim());
  return lines[lines.length - 1] ?? msg;
}
