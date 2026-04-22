import { spawn } from "node:child_process";

export function runAppleScript(scriptLines: string[], args: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    const osaArgs: string[] = [];
    for (const line of scriptLines) osaArgs.push("-e", line);
    if (args.length > 0) {
      osaArgs.push("--");
      osaArgs.push(...args);
    }

    const proc = spawn("osascript", osaArgs);
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (e) => { reject(new Error(`Failed to run osascript: ${e.message}`)); });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `osascript exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}
