// Chrome integration helpers.
// - Open tabs: queried via AppleScript ("tell application 'Google Chrome'")
// - Bookmarks: read locally from Chrome's Bookmarks JSON file
// - Activate tab: AppleScript focuses the window/tab pair

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface OpenTab {
  windowIndex: number;
  tabIndex: number;
  title: string;
  url: string;
}

export interface Bookmark {
  title: string;
  url: string;
  folder: string;
}

function runAppleScript(script: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("osascript", ["-e", script]);
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
      if (killed) return reject(new Error("AppleScript timed out"));
      if (code !== 0) return reject(new Error(err.trim() || `Exit code ${code}`));
      resolve(out);
    });
  });
}

export async function listOpenTabs(): Promise<OpenTab[]> {
  // AppleScript emits one row per tab. Use "|||" as delimiter so titles
  // can contain commas/tabs without breaking parsing.
  const script = `
set output to ""
tell application "Google Chrome"
  if not (exists window 1) then return ""
  set wIdx to 0
  repeat with w in windows
    set wIdx to wIdx + 1
    set tIdx to 0
    repeat with t in tabs of w
      set tIdx to tIdx + 1
      try
        set output to output & wIdx & "|||" & tIdx & "|||" & (title of t) & "|||" & (URL of t) & linefeed
      end try
    end repeat
  end repeat
end tell
return output`;
  const result = await runAppleScript(script, 8000);
  if (!result.trim()) return [];
  return result
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split("|||");
      if (parts.length < 4) return null;
      return {
        windowIndex: parseInt(parts[0], 10) || 1,
        tabIndex: parseInt(parts[1], 10) || 1,
        title: parts[2] ?? "",
        url: parts.slice(3).join("|||"),
      } as OpenTab;
    })
    .filter((t): t is OpenTab => t !== null);
}

export async function activateTab(windowIndex: number, tabIndex: number): Promise<void> {
  const script = `
tell application "Google Chrome"
  activate
  set index of window ${windowIndex} to 1
  set active tab index of window ${windowIndex} to ${tabIndex}
end tell`;
  await runAppleScript(script, 4000);
}

interface ChromeBookmarkNode {
  type?: string;
  name?: string;
  url?: string;
  children?: ChromeBookmarkNode[];
}

interface ChromeBookmarksFile {
  roots?: Record<string, ChromeBookmarkNode>;
}

function flattenBookmarks(node: ChromeBookmarkNode, folder: string, out: Bookmark[]): void {
  if (node.type === "url" && node.url && node.name) {
    out.push({ title: node.name, url: node.url, folder });
    return;
  }
  if (node.children) {
    const sub = node.name ? (folder ? `${folder} / ${node.name}` : node.name) : folder;
    for (const c of node.children) flattenBookmarks(c, sub, out);
  }
}

export async function readBookmarks(profile = "Default"): Promise<Bookmark[]> {
  const path = join(homedir(), "Library", "Application Support", "Google", "Chrome", profile, "Bookmarks");
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    throw new Error(`Could not read Chrome bookmarks (profile: ${profile}). Has Chrome been opened with this profile?`);
  }
  const parsed = JSON.parse(raw) as ChromeBookmarksFile;
  const out: Bookmark[] = [];
  for (const [, root] of Object.entries(parsed.roots ?? {})) {
    flattenBookmarks(root, "", out);
  }
  return out;
}
