import { spawn } from "node:child_process";

export async function getClipboard(): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn("pbpaste");
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `pbpaste exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function setClipboard(value: string): Promise<void> {
  return await new Promise((resolve, reject) => {
    const child = spawn("pbcopy");
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `pbcopy exited with code ${code}`));
        return;
      }
      resolve();
    });
    child.stdin.end(value);
  });
}
