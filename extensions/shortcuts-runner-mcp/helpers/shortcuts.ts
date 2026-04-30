import { spawn } from "node:child_process";

async function runCommand(
  cmd: string,
  args: string[],
  stdin?: string,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", () => resolve({ ok: false, stdout, stderr }));
    child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr: stderr.trim() }));
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

export async function listShortcuts(): Promise<string[]> {
  const { ok, stdout, stderr } = await runCommand("shortcuts", ["list"]);
  if (!ok) throw new Error(stderr || "shortcuts CLI failed");
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export interface RunResult {
  ok: boolean;
  output: string;
  error: string;
}

export async function runShortcut(name: string, input?: string): Promise<RunResult> {
  const { ok, stdout, stderr } = await runCommand("shortcuts", ["run", name], input);
  return { ok, output: stdout, error: stderr };
}
