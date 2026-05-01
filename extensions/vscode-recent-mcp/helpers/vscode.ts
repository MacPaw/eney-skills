// VS Code recents reader.
// VS Code stores its global state in a SQLite database at
// ~/Library/Application Support/Code/User/globalStorage/state.vscdb.
// The "history.recentlyOpenedPathsList" key holds a JSON value with the
// list of recently opened workspaces, folders, and files. We query it
// with the macOS-built-in sqlite3 CLI to avoid native deps.

import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

export interface RecentEntry {
  kind: "workspace" | "folder" | "file";
  path: string;
  label: string;
}

const STATE_DB = join(
  homedir(),
  "Library",
  "Application Support",
  "Code",
  "User",
  "globalStorage",
  "state.vscdb",
);

const RECENT_KEY = "history.recentlyOpenedPathsList";

function runCmd(cmd: string, args: string[], timeoutMs = 6000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = "";
    let err = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);
    proc.stdout?.on("data", (d) => {
      out += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(t);
      if (killed) return reject(new Error("Timed out"));
      if (code !== 0) return reject(new Error(err.trim() || `Exit code ${code}`));
      resolve(out);
    });
  });
}

interface RawList {
  entries?: Array<{
    workspace?: { configPath?: string; folderUri?: string; id?: string };
    folderUri?: string;
    fileUri?: string;
    label?: string;
  }>;
}

function fileUriToPath(uri: string): string {
  if (!uri.startsWith("file://")) return uri;
  try {
    return decodeURIComponent(uri.slice("file://".length));
  } catch {
    return uri;
  }
}

function basename(p: string): string {
  const cleaned = p.replace(/\/$/, "");
  const i = cleaned.lastIndexOf("/");
  return i >= 0 ? cleaned.slice(i + 1) : cleaned;
}

export async function readRecents(): Promise<RecentEntry[]> {
  if (!existsSync(STATE_DB)) {
    throw new Error(`VS Code state DB not found at ${STATE_DB}. Has VS Code been opened on this Mac?`);
  }
  const raw = await runCmd(
    "sqlite3",
    ["-readonly", STATE_DB, `SELECT value FROM ItemTable WHERE key='${RECENT_KEY}'`],
    8000,
  );
  if (!raw.trim()) return [];
  let parsed: RawList;
  try {
    parsed = JSON.parse(raw.trim()) as RawList;
  } catch (err) {
    throw new Error(`Could not parse VS Code recents JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const out: RecentEntry[] = [];
  for (const e of parsed.entries ?? []) {
    if (e.workspace?.configPath) {
      const path = fileUriToPath(e.workspace.configPath);
      out.push({ kind: "workspace", path, label: e.label ?? basename(path) });
    } else if (e.workspace?.folderUri) {
      const path = fileUriToPath(e.workspace.folderUri);
      out.push({ kind: "folder", path, label: e.label ?? basename(path) });
    } else if (e.folderUri) {
      const path = fileUriToPath(e.folderUri);
      out.push({ kind: "folder", path, label: e.label ?? basename(path) });
    } else if (e.fileUri) {
      const path = fileUriToPath(e.fileUri);
      out.push({ kind: "file", path, label: e.label ?? basename(path) });
    }
  }
  return out;
}

export async function openInVsCode(path: string): Promise<void> {
  if (!path.trim()) throw new Error("Empty path.");
  // Prefer the `code` CLI if available; fall back to `open -a "Visual Studio Code"`.
  try {
    await runCmd("code", [path]);
    return;
  } catch {
    /* fall through */
  }
  await runCmd("open", ["-a", "Visual Studio Code", path]);
}
