import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const APP_DIRS = ["/Applications", "/System/Applications", join(homedir(), "Applications")];

async function listAppsIn(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      if (entry.name.endsWith(".app")) out.push(entry.name.slice(0, -4));
      if (entry.isDirectory() && entry.name === "Utilities") {
        const sub = await listAppsIn(join(dir, entry.name));
        out.push(...sub);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function listInstalledApps(): Promise<string[]> {
  const lists = await Promise.all(APP_DIRS.map((d) => listAppsIn(d)));
  const set = new Set<string>();
  for (const l of lists) for (const name of l) set.add(name);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function launchApp(name: string): Promise<void> {
  return await new Promise((resolve, reject) => {
    const child = spawn("open", ["-a", name]);
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `open -a "${name}" exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

export function appBaseName(path: string): string {
  return basename(path).replace(/\.app$/, "");
}
