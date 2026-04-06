import { spawn } from "node:child_process";

export function runJXA(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const osascript = spawn("osascript", ["-l", "JavaScript", "-e", script]);
    let stderr = "";
    let stdout = "";

    osascript.stdout?.on("data", (data) => { stdout += data.toString(); });
    osascript.stderr?.on("data", (data) => { stderr += data.toString(); });
    osascript.on("error", (error) => { reject(new Error(`Failed to execute JXA: ${error.message}`)); });
    osascript.on("close", (code) => {
      if (code !== 0) { reject(new Error(stderr.trim() || `osascript exited with code ${code}`)); return; }
      resolve(stdout.trim());
    });
  });
}