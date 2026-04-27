import { execFile } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

const GWS_SCRIPT = join(__dirname, "..", "node_modules", "@googleworkspace", "cli", "run.js");

export async function execGws(args: string[], token?: string): Promise<string> {
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
