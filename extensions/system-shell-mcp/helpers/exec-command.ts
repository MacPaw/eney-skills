import { spawn } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  cwd: string;
  durationMs: number;
}

const MAX_OUTPUT = 50_000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n[... truncated ${text.length - max} characters]`;
}

export function execCommand(
  command: string,
  options?: { cwd?: string; timeoutMs?: number },
): Promise<ExecResult> {
  const cwd = options?.cwd ?? process.env.HOME ?? "/";
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const start = Date.now();

  return new Promise((resolve) => {
    const child = spawn("zsh", ["-lc", command], {
      cwd,
      timeout: timeoutMs,
      env: {
        ...process.env,
        PATH: [
          "/opt/homebrew/bin",
          "/opt/homebrew/sbin",
          "/usr/local/bin",
          process.env.PATH,
        ]
          .filter(Boolean)
          .join(":"),
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (error: Error) => {
      resolve({
        stdout: "",
        stderr: error.message,
        exitCode: 1,
        command,
        cwd,
        durationMs: Date.now() - start,
      });
    });

    child.on("close", (code: number | null) => {
      resolve({
        stdout: truncate(stdout, MAX_OUTPUT),
        stderr: truncate(stderr, MAX_OUTPUT),
        exitCode: code ?? 1,
        command,
        cwd,
        durationMs: Date.now() - start,
      });
    });
  });
}
