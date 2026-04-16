import { exec } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));

export const GWS_BIN = join(
  __dirname,
  "..",
  "bin",
  process.arch === "arm64" ? "gws-arm64" : "gws-x64"
);

export async function execGws(args: string, token?: string): Promise<string> {
  const { stdout } = await execAsync(`"${GWS_BIN}" ${args}`, {
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

export function docsToken(): string {
  return process.env.GOOGLE_DOCS_TOKEN ?? "";
}

export function sheetsToken(): string {
  return process.env.GOOGLE_SHEETS_TOKEN ?? "";
}

export function slidesToken(): string {
  return process.env.GOOGLE_SLIDES_TOKEN ?? "";
}
