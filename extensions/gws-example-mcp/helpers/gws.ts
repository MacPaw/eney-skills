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

type Logger = {
  info: (...data: unknown[]) => void;
  debug: (...data: unknown[]) => void;
  warn: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
};

export async function execGws(args: string, token?: string, logger?: Logger): Promise<string> {
  const resolvedToken = token ?? process.env.GOOGLE_WORKSPACE_CLI_TOKEN ?? "";
  const maskedToken = resolvedToken
    ? resolvedToken.slice(0, 8) + "…" + resolvedToken.slice(-4)
    : "(empty)";
  logger?.debug(`[gws] token=${maskedToken} cmd=${args}`);
  const { stdout, stderr } = await execAsync(`"${GWS_BIN}" ${args}`, {
    timeout: 30000,
    env: { ...process.env, GOOGLE_WORKSPACE_CLI_TOKEN: resolvedToken },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (stderr) logger?.warn(`[gws] stderr=${stderr.trim()}`);
  logger?.debug(`[gws] stdout=${stdout.trim() || "(empty)"}`);
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
