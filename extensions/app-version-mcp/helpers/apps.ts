import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const APP_ROOTS = ["/Applications", "/System/Applications", "/System/Applications/Utilities", join(homedir(), "Applications")];

export interface InstalledApp {
  name: string;
  path: string;
}

async function listAppsIn(dir: string): Promise<InstalledApp[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: InstalledApp[] = [];
    for (const entry of entries) {
      if (entry.name.endsWith(".app")) {
        out.push({ name: entry.name.slice(0, -4), path: join(dir, entry.name) });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function listInstalledApps(): Promise<InstalledApp[]> {
  const lists = await Promise.all(APP_ROOTS.map((d) => listAppsIn(d)));
  const seen = new Map<string, InstalledApp>();
  for (const list of lists) {
    for (const app of list) if (!seen.has(app.name)) seen.set(app.name, app);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface AppInfo {
  name: string;
  path: string;
  version: string;
  build: string;
  bundleId: string;
  minimumSystemVersion: string;
}

async function plutilJson(plistPath: string): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    const child = spawn("plutil", ["-convert", "json", "-o", "-", plistPath]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `plutil exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function readAppInfo(app: InstalledApp): Promise<AppInfo> {
  const plistPath = join(app.path, "Contents/Info.plist");
  const data = await plutilJson(plistPath);
  return {
    name: app.name,
    path: app.path,
    version: asString(data.CFBundleShortVersionString),
    build: asString(data.CFBundleVersion),
    bundleId: asString(data.CFBundleIdentifier),
    minimumSystemVersion: asString(data.LSMinimumSystemVersion),
  };
}
