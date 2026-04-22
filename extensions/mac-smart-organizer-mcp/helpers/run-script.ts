import { spawn } from "node:child_process";

function runAppleScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const osa = spawn("osascript", ["-e", script]);
    let stderr = "";
    let stdout = "";
    osa.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    osa.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    osa.on("error", (e: Error) => reject(new Error(`osascript failed: ${e.message}`)));
    osa.on("close", (code: number | null) => {
      if (code === null || code !== 0) {
        reject(new Error(stderr.trim() || `osascript exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("error", (e: Error) => reject(new Error(`${cmd} failed: ${e.message}`)));
    child.on("close", (code: number | null) => {
      if (code === null || code !== 0) {
        reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function escapeAppleScriptString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export async function setFinderLabel(path: string, labelIndex: number): Promise<void> {
  const safePath = escapeAppleScriptString(path);
  const script = `tell application "Finder" to set label index of (POSIX file "${safePath}" as alias) to ${labelIndex}`;
  await runAppleScript(script);
}

export async function revealInFinder(path: string): Promise<void> {
  const safePath = escapeAppleScriptString(path);
  const script = `tell application "Finder" to reveal (POSIX file "${safePath}" as alias)\ntell application "Finder" to activate`;
  await runAppleScript(script);
}
