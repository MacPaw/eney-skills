import { spawn, SpawnOptions } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function run(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
  onOutput?: (chunk: string, stream: "stdout" | "stderr") => void,
): Promise<RunResult> {
  return await new Promise((resolve, reject) => {
    const proc = spawn(command, args, { ...options, env: { ...process.env, ...(options.env ?? {}) } });
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      onOutput?.(text, "stdout");
    });
    proc.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      onOutput?.(text, "stderr");
    });
    proc.on("error", (error) => reject(error));
    proc.on("close", (code) => {
      resolve({ code: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

export async function tryRun(command: string, args: string[] = []): Promise<RunResult | null> {
  try {
    return await run(command, args);
  } catch {
    return null;
  }
}
