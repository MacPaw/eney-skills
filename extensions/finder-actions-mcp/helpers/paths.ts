import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

export function expandPath(input: string): string {
  let p = input.trim();
  if (!p) return p;
  if (p === "~" || p.startsWith("~/")) {
    p = p === "~" ? homedir() : `${homedir()}/${p.slice(2)}`;
  }
  return resolve(p);
}

export async function openPath(path: string, reveal: boolean): Promise<void> {
  const args = reveal ? ["-R", path] : [path];
  return await new Promise((resolveFn, reject) => {
    const child = spawn("open", args);
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `open exited with code ${code}`));
        return;
      }
      resolveFn();
    });
  });
}
