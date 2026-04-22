import { access, mkdir, readdir, rename, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { runAppleScript } from "./run-script.js";

export const AGE_DAYS = 30;
const AGE_MS = AGE_DAYS * 24 * 60 * 60 * 1000;

const ALIASES: Record<string, string> = {
  desktop: "Desktop",
  downloads: "Downloads",
  documents: "Documents",
};

// Screenshots and screen recordings: match the phrase anywhere in the filename
// (not just at the start) so tool-prefixed names like
// "Simulator Screen Recording - iPhone 15 Pro - …mov" or
// "Simulator Screenshot - …png" are caught.
const PATTERNS: RegExp[] = [
  /Screen ?Shot\b.*\.(png|jpg|jpeg|heic)$/i,
  /Screenshot\b.*\.(png|jpg|jpeg|heic)$/i,
  /CleanShot\b.*\.(png|jpg|jpeg|heic|mov|mp4)$/i,
  /Screen Recording\b.*\.(mov|mp4|m4v)$/i,
  /\.dmg$/i,
  /\.pkg$/i,
  /\.zip$/i,
  /\.tar$/i,
  /\.tar\.gz$/i,
  /\.tgz$/i,
  /\.rar$/i,
  /\.7z$/i,
];

export function resolveFolder(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Folder path is required.");

  const aliasKey = trimmed.toLowerCase();
  if (ALIASES[aliasKey]) return path.join(homedir(), ALIASES[aliasKey]);

  if (trimmed.startsWith("~/")) return path.join(homedir(), trimmed.slice(2));
  if (trimmed === "~") return homedir();

  return path.resolve(trimmed);
}

export type Candidate = {
  name: string;
  fullPath: string;
  size: number;
};

export async function scanFolder(folder: string): Promise<Candidate[]> {
  const folderStat = await stat(folder);
  if (!folderStat.isDirectory()) {
    throw new Error(`Not a directory: ${folder}`);
  }

  const entries = await readdir(folder, { withFileTypes: true });
  const now = Date.now();
  const matches: Candidate[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!PATTERNS.some((re) => re.test(entry.name))) continue;

    const full = path.join(folder, entry.name);
    const s = await stat(full);
    // mtime only: atime gets bumped by Finder thumbnails, Spotlight indexing
    // and backup software, which would falsely keep old files from being
    // considered stale.
    if (now - s.mtimeMs < AGE_MS) continue;

    matches.push({ name: entry.name, fullPath: full, size: s.size });
  }

  matches.sort((a, b) => b.size - a.size);
  return matches;
}

export async function moveToTrash(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const script = [
    "on run argv",
    '  tell application "Finder"',
    "    repeat with p in argv",
    "      move (POSIX file (p as string) as alias) to trash",
    "    end repeat",
    "  end tell",
    "end run",
  ];

  await runAppleScript(script, paths);
}

export const UNTIDY_FOLDER_NAME = "untidy";

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function uniqueTargetPath(dir: string, name: string): Promise<string> {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = path.join(dir, name);
  let i = 2;
  while (await exists(candidate)) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
    i++;
  }
  return candidate;
}

/**
 * Move files into `<parent>/untidy/`, creating the folder if needed.
 * Returns the absolute path to the destination folder.
 * Name collisions get a numeric suffix (e.g. `Screenshot (2).png`).
 */
export async function moveToUntidyFolder(
  parent: string,
  paths: string[],
): Promise<string> {
  const destFolder = path.join(parent, UNTIDY_FOLDER_NAME);
  await mkdir(destFolder, { recursive: true });
  for (const src of paths) {
    const target = await uniqueTargetPath(destFolder, path.basename(src));
    await rename(src, target);
  }
  return destFolder;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}
