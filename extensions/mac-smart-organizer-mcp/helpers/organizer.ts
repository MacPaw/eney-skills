import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { homedir } from "node:os";
import { setFinderLabel } from "./run-script.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FileEntry {
  path: string;
  name: string;
  ext: string;
  size: number;
  mtime: Date;
  hash?: string;
}

export interface SubdirectoryInfo {
  path: string;
  name: string;
  fileCount: number;
  sampleFiles: string[];
}

export type MoveAction = {
  type: "move";
  from: string;
  to: string;
  category: string;
  folderName: string;
  reason: string;
};

export type ArchiveAction = {
  type: "archive";
  from: string;
  to: string;
  ageDays: number;
};

export type DuplicateAction = {
  type: "duplicate";
  from: string;
  to: string;
  keeps: string;
  size: number;
};

export type TagAction = {
  type: "tag";
  path: string;
  label: number;
  labelName: string;
};

export type RenamePureAction = {
  type: "rename";
  from: string;
  to: string;
};

export type MoveFolderAction = {
  type: "move_folder";
  from: string;
  to: string;
  parentName: string;
};

export type PlanAction =
  | MoveAction
  | ArchiveAction
  | DuplicateAction
  | TagAction
  | RenamePureAction
  | MoveFolderAction;

export interface Plan {
  root: string;
  totalFiles: number;
  skipped: number;
  actions: PlanAction[];
  categoryCounts: Record<string, number>;
  existingFolders: Record<string, string>;
  duplicateBytes: number;
}

export interface PlanOptions {
  applyFinderTags: boolean;
  renameFiles: boolean;
  duplicateHandling: "skip" | "flag" | "move";
  archiveDaysThreshold: number;
  classifications?: Record<string, string>;
  folderGroupings?: Record<string, string>;
}

export interface ExecuteResult {
  applied: number;
  failed: { action: PlanAction; error: string }[];
  destinations: string[];
}

// ── Label constants ────────────────────────────────────────────────────────

export const LABEL = {
  none: 0,
  grey: 1,
  green: 2,
  purple: 3,
  blue: 4,
  yellow: 5,
  red: 6,
  orange: 7,
} as const;

// ── Extension map ──────────────────────────────────────────────────────────

interface CategorySpec { name: string; label: number }

export const EXT_MAP: Record<string, CategorySpec> = {
  ".jpg": { name: "Images", label: LABEL.green },
  ".jpeg": { name: "Images", label: LABEL.green },
  ".png": { name: "Images", label: LABEL.green },
  ".gif": { name: "Images", label: LABEL.green },
  ".heic": { name: "Images", label: LABEL.green },
  ".webp": { name: "Images", label: LABEL.green },
  ".tiff": { name: "Images", label: LABEL.green },
  ".bmp": { name: "Images", label: LABEL.green },
  ".svg": { name: "Images", label: LABEL.green },
  ".mp4": { name: "Videos", label: LABEL.green },
  ".mov": { name: "Videos", label: LABEL.green },
  ".avi": { name: "Videos", label: LABEL.green },
  ".mkv": { name: "Videos", label: LABEL.green },
  ".m4v": { name: "Videos", label: LABEL.green },
  ".mp3": { name: "Audio", label: LABEL.green },
  ".wav": { name: "Audio", label: LABEL.green },
  ".flac": { name: "Audio", label: LABEL.green },
  ".m4a": { name: "Audio", label: LABEL.green },
  ".aac": { name: "Audio", label: LABEL.green },
  ".pdf": { name: "Documents", label: LABEL.blue },
  ".doc": { name: "Documents", label: LABEL.blue },
  ".docx": { name: "Documents", label: LABEL.blue },
  ".pages": { name: "Documents", label: LABEL.blue },
  ".txt": { name: "Documents", label: LABEL.blue },
  ".md": { name: "Documents", label: LABEL.blue },
  ".rtf": { name: "Documents", label: LABEL.blue },
  ".xls": { name: "Spreadsheets", label: LABEL.blue },
  ".xlsx": { name: "Spreadsheets", label: LABEL.blue },
  ".csv": { name: "Spreadsheets", label: LABEL.blue },
  ".numbers": { name: "Spreadsheets", label: LABEL.blue },
  ".ppt": { name: "Presentations", label: LABEL.blue },
  ".pptx": { name: "Presentations", label: LABEL.blue },
  ".key": { name: "Presentations", label: LABEL.blue },
  ".psd": { name: "Design Assets", label: LABEL.purple },
  ".ai": { name: "Design Assets", label: LABEL.purple },
  ".fig": { name: "Design Assets", label: LABEL.purple },
  ".sketch": { name: "Design Assets", label: LABEL.purple },
  ".xd": { name: "Design Assets", label: LABEL.purple },
  ".ts": { name: "Code", label: LABEL.purple },
  ".tsx": { name: "Code", label: LABEL.purple },
  ".js": { name: "Code", label: LABEL.purple },
  ".jsx": { name: "Code", label: LABEL.purple },
  ".py": { name: "Code", label: LABEL.purple },
  ".go": { name: "Code", label: LABEL.purple },
  ".rs": { name: "Code", label: LABEL.purple },
  ".swift": { name: "Code", label: LABEL.purple },
  ".rb": { name: "Code", label: LABEL.purple },
  ".java": { name: "Code", label: LABEL.purple },
  ".html": { name: "Code", label: LABEL.purple },
  ".css": { name: "Code", label: LABEL.purple },
  ".json": { name: "Code", label: LABEL.purple },
  ".sh": { name: "Code", label: LABEL.purple },
  ".zip": { name: "Archives", label: LABEL.grey },
  ".tar": { name: "Archives", label: LABEL.grey },
  ".gz": { name: "Archives", label: LABEL.grey },
  ".rar": { name: "Archives", label: LABEL.grey },
  ".7z": { name: "Archives", label: LABEL.grey },
  ".dmg": { name: "Installers", label: LABEL.yellow },
  ".pkg": { name: "Installers", label: LABEL.yellow },
  ".epub": { name: "Books", label: LABEL.blue },
  ".mobi": { name: "Books", label: LABEL.blue },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function expandHome(p: string): string {
  if (p.startsWith("~")) return join(homedir(), p.slice(1));
  return p;
}

const SKIP_FILENAMES = new Set([".DS_Store", ".localized", "Icon\r"]);

export async function scanDirectory(rootInput: string): Promise<FileEntry[]> {
  const root = expandHome(rootInput);
  const entries = await readdir(root, { withFileTypes: true });
  const results: FileEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (SKIP_FILENAMES.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(root, entry.name);
    const st = await stat(fullPath);
    results.push({
      path: fullPath,
      name: entry.name,
      ext: extname(entry.name),
      size: st.size,
      mtime: st.mtime,
    });
  }
  return results;
}

export async function listSubdirectories(rootInput: string): Promise<string[]> {
  const root = expandHome(rootInput);
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

export async function scanSubdirectories(
  rootInput: string
): Promise<SubdirectoryInfo[]> {
  const root = expandHome(rootInput);
  const folders: SubdirectoryInfo[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const folderPath = join(root, entry.name);
      try {
        const contents = await readdir(folderPath);
        const visible = contents.filter((n) => !n.startsWith("."));
        folders.push({
          path: folderPath,
          name: entry.name,
          fileCount: visible.length,
          sampleFiles: visible.slice(0, 8),
        });
      } catch {
        // skip unreadable
      }
    }
  } catch {
    return [];
  }
  return folders;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// ── Categorization ─────────────────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string[]> = {
  "Images": ["photos", "pictures", "pics", "images"],
  "Videos": ["videos", "movies", "video"],
  "Audio": ["audio", "music", "sounds"],
  "Documents": ["documents", "docs"],
  "Spreadsheets": ["spreadsheets", "sheets"],
  "Presentations": ["presentations", "slides", "decks"],
  "Screenshots": ["screenshots"],
  "Design Assets": ["design assets", "design", "designs", "mockups"],
  "Code": ["code", "source", "src"],
  "Archives": ["archives", "zips", "zip"],
  "Installers": ["installers", "apps"],
  "Books": ["books", "ebooks"],
  "Invoices & Receipts": ["invoices & receipts", "invoices", "receipts"],
  "Tax Documents": ["tax documents", "taxes", "tax"],
  "Contracts": ["contracts", "agreements"],
  "Career": ["career", "resumes", "cvs"],
  "Personal Documents": ["personal documents", "personal"],
  "Travel": ["travel", "trips"],
};

const KEYWORD_RULES: { match: RegExp; category: CategorySpec }[] = [
  { match: /(invoice|receipt|bill|payment|statement)/i, category: { name: "Invoices & Receipts", label: LABEL.red } },
  { match: /(tax|1099|w-?2|irs)/i, category: { name: "Tax Documents", label: LABEL.blue } },
  { match: /(contract|agreement|nda|loe)/i, category: { name: "Contracts", label: LABEL.blue } },
  { match: /(resume|cv)/i, category: { name: "Career", label: LABEL.blue } },
  { match: /(passport|license|identity|id[\s_-]?card|ssn)/i, category: { name: "Personal Documents", label: LABEL.red } },
  { match: /(screenshot|screen[\s_-]shot)/i, category: { name: "Screenshots", label: LABEL.green } },
  { match: /(itinerary|boarding[\s_-]?pass|ticket|reservation)/i, category: { name: "Travel", label: LABEL.orange } },
];

const CATEGORY_LABELS: Record<string, number> = {
  "Images": LABEL.green, "Videos": LABEL.green, "Audio": LABEL.green,
  "Documents": LABEL.blue, "Spreadsheets": LABEL.blue, "Presentations": LABEL.blue,
  "Screenshots": LABEL.green, "Design Assets": LABEL.purple, "Code": LABEL.purple,
  "Archives": LABEL.grey, "Installers": LABEL.yellow, "Books": LABEL.blue,
  "Invoices & Receipts": LABEL.red, "Tax Documents": LABEL.blue, "Contracts": LABEL.blue,
  "Career": LABEL.blue, "Personal Documents": LABEL.red, "Travel": LABEL.orange,
  "Other": LABEL.none,
};

function categorize(name: string, ext: string): CategorySpec {
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(name)) return rule.category;
  }
  return EXT_MAP[ext.toLowerCase()] ?? { name: "Other", label: LABEL.none };
}

function labelForFolderName(name: string): number {
  const lower = name.toLowerCase();
  if (/\b(image|photo|picture|screenshot)\b/.test(lower)) return LABEL.green;
  if (/\b(video|movie|film|clip)\b/.test(lower)) return LABEL.green;
  if (/\b(audio|music|sound|podcast)\b/.test(lower)) return LABEL.green;
  if (/\b(invoice|receipt|billing|payment)\b/.test(lower)) return LABEL.red;
  if (/\b(tax|irs|financial|finance)\b/.test(lower)) return LABEL.blue;
  if (/\b(contract|agreement|legal|nda)\b/.test(lower)) return LABEL.blue;
  if (/\b(document|doc|pdf|paper|report|resume|cv)\b/.test(lower)) return LABEL.blue;
  if (/\b(book|ebook|reading)\b/.test(lower)) return LABEL.blue;
  if (/\b(design|mockup|figma|sketch|asset|ui|ux)\b/.test(lower)) return LABEL.purple;
  if (/\b(code|source|software|dev|project|app)\b/.test(lower)) return LABEL.purple;
  if (/\b(archive|backup|old)\b/.test(lower)) return LABEL.grey;
  if (/\b(install|installer)\b/.test(lower)) return LABEL.yellow;
  if (/\b(travel|trip|flight|hotel|itinerary|ticket)\b/.test(lower)) return LABEL.orange;
  return LABEL.none;
}

const NOISY_PREFIX = /^(IMG|DSC|DSCN|PXL|VID|MOV|SCAN|DOC)[_-]?\d+/i;
const REDUNDANT_SUFFIX = /(^|[_\s-])(final|copy|draft)(\s+\2)*(\s*\(\d+\))?$/i;
const NUMERIC_COPY_SUFFIX = /\s*\(\d+\)$/;

function cleanFilename(name: string, ext: string): string {
  const base = name.slice(0, name.length - ext.length);
  const hasNoisyPrefix = NOISY_PREFIX.test(base);
  const hasRedundantSuffix = REDUNDANT_SUFFIX.test(base) || NUMERIC_COPY_SUFFIX.test(base);
  if (!hasNoisyPrefix && !hasRedundantSuffix) return name;
  let cleaned = base;
  if (hasNoisyPrefix) cleaned = cleaned.replace(/^(IMG|DSC|DSCN|PXL|VID|MOV|SCAN|DOC)[_-]?0*/i, "");
  cleaned = cleaned.replace(NUMERIC_COPY_SUFFIX, "");
  cleaned = cleaned.replace(/([_\s-])(final|copy|draft)(\1(final|copy|draft))*$/gi, "");
  cleaned = cleaned.trim();
  if (!cleaned) return name;
  return cleaned + ext;
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha1");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function ensureUniquePath(targetDir: string, filename: string): Promise<string> {
  const ext = extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  let candidate = join(targetDir, filename);
  let counter = 1;
  while (await pathExists(candidate)) {
    candidate = join(targetDir, `${base}-${counter}${ext}`);
    counter += 1;
  }
  return candidate;
}

async function pathExists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function discoverExistingFolders(
  rootPath: string
): Promise<Map<string, string>> {
  const existing: string[] = [];
  try {
    const entries = await readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith("."))
        existing.push(entry.name);
    }
  } catch {
    return new Map();
  }
  const lookup = new Map<string, string>();
  for (const name of existing) lookup.set(name.toLowerCase(), name);
  const map = new Map<string, string>();
  for (const [canonical, aliasList] of Object.entries(CATEGORY_ALIASES)) {
    for (const alias of aliasList) {
      const hit = lookup.get(alias);
      if (hit) { map.set(canonical, hit); break; }
    }
  }
  return map;
}

function labelName(index: number): string {
  const names = ["none", "grey", "green", "purple", "blue", "yellow", "red", "orange"];
  return names[index] ?? "none";
}

export async function buildPlan(
  rootInput: string,
  options: PlanOptions
): Promise<Plan> {
  const root = expandHome(rootInput);
  const files = await scanDirectory(root);
  const existingFolderMap = await discoverExistingFolders(root);
  const existingDirNames = await listSubdirectories(root);
  const existingDirLookup = new Map(existingDirNames.map((n) => [n.toLowerCase(), n]));
  const existingFolders: Record<string, string> = {};
  for (const [k, v] of existingFolderMap) existingFolders[k] = v;

  // Duplicate detection — hash files sharing the same size
  const now = Date.now();
  const bySize = new Map<number, FileEntry[]>();
  for (const f of files) {
    const bucket = bySize.get(f.size) ?? [];
    bucket.push(f);
    bySize.set(f.size, bucket);
  }
  for (const [, bucket] of bySize) {
    if (bucket.length < 2) continue;
    for (const f of bucket) f.hash = await hashFile(f.path);
  }
  const byHash = new Map<string, FileEntry[]>();
  for (const f of files) {
    if (!f.hash) continue;
    const bucket = byHash.get(f.hash) ?? [];
    bucket.push(f);
    byHash.set(f.hash, bucket);
  }
  const duplicatePaths = new Set<string>();
  const duplicateMap = new Map<string, string>();
  let duplicateBytes = 0;
  for (const [, bucket] of byHash) {
    if (bucket.length < 2) continue;
    bucket.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    const keeper = bucket[0];
    for (let i = 1; i < bucket.length; i++) {
      duplicatePaths.add(bucket[i].path);
      duplicateMap.set(bucket[i].path, keeper.path);
      duplicateBytes += bucket[i].size;
    }
  }

  const actions: PlanAction[] = [];
  const categoryCounts: Record<string, number> = {};
  let skipped = 0;

  for (const f of files) {
    const ageDays = Math.floor((now - f.mtime.getTime()) / 86_400_000);

    if (duplicatePaths.has(f.path)) {
      const keeper = duplicateMap.get(f.path)!;
      if (options.duplicateHandling === "skip") { skipped++; continue; }
      if (options.duplicateHandling === "move") {
        actions.push({ type: "duplicate", from: f.path, to: join(root, "Duplicates", f.name), keeps: keeper, size: f.size });
        continue;
      }
      if (options.duplicateHandling === "flag") {
        actions.push({ type: "tag", path: f.path, label: LABEL.orange, labelName: "orange" });
        continue;
      }
    }

    if (options.archiveDaysThreshold > 0 && ageDays >= options.archiveDaysThreshold) {
      actions.push({ type: "archive", from: f.path, to: join(root, "Archive", f.name), ageDays });
      continue;
    }

    const llmFolder = options.classifications?.[f.name];
    if (llmFolder) {
      if (llmFolder === "Other") { skipped++; continue; }
      const matchedDir = existingDirLookup.get(llmFolder.toLowerCase());
      const folderName = matchedDir ?? llmFolder;
      const label = labelForFolderName(folderName);
      categoryCounts[folderName] = (categoryCounts[folderName] ?? 0) + 1;
      if (matchedDir) existingFolders[folderName] = folderName;
      const cleanedName = options.renameFiles ? cleanFilename(f.name, f.ext) : f.name;
      const destPath = join(root, folderName, cleanedName);
      actions.push({
        type: "move", from: f.path, to: destPath,
        category: folderName, folderName,
        reason: cleanedName !== f.name ? `renamed + sorted into ${folderName}` : `sorted into ${folderName}`,
      });
      if (options.applyFinderTags && label !== LABEL.none) {
        actions.push({ type: "tag", path: destPath, label, labelName: labelName(label) });
      }
      continue;
    }

    const category = categorize(f.name, f.ext);
    if (category.name === "Other") { skipped++; continue; }
    categoryCounts[category.name] = (categoryCounts[category.name] ?? 0) + 1;
    const cleanedName = options.renameFiles ? cleanFilename(f.name, f.ext) : f.name;
    const folderName = existingFolderMap.get(category.name) ?? category.name;
    const destPath = join(root, folderName, cleanedName);
    const reusedNote = existingFolderMap.has(category.name) ? " (existing folder)" : "";
    if (existingFolderMap.has(category.name)) existingFolders[category.name] = folderName;
    actions.push({
      type: "move", from: f.path, to: destPath,
      category: category.name, folderName,
      reason: cleanedName !== f.name ? `renamed + sorted into ${folderName}${reusedNote}` : `sorted into ${folderName}${reusedNote}`,
    });
    if (options.applyFinderTags && category.label !== LABEL.none) {
      actions.push({ type: "tag", path: destPath, label: category.label, labelName: labelName(category.label) });
    }
  }

  // Folder groupings
  if (options.folderGroupings) {
    for (const [folderName, parentName] of Object.entries(options.folderGroupings)) {
      actions.push({
        type: "move_folder",
        from: join(root, folderName),
        to: join(root, parentName, folderName),
        parentName,
      });
    }
  }

  return { root, totalFiles: files.length, skipped, actions, categoryCounts, existingFolders, duplicateBytes };
}

export async function executePlan(plan: Plan): Promise<ExecuteResult> {
  const result: ExecuteResult = { applied: 0, failed: [], destinations: [] };
  const destinationsSet = new Set<string>();
  const tagQueue: TagAction[] = [];
  const folderMoveQueue: MoveFolderAction[] = [];
  const filePathRemap = new Map<string, string>();

  // Phase 1: file moves
  for (const action of plan.actions) {
    if (action.type === "tag") { tagQueue.push(action); continue; }
    if (action.type === "move_folder") { folderMoveQueue.push(action); continue; }
    try {
      if (action.type === "move" || action.type === "archive" || action.type === "duplicate") {
        const destDir = dirname(action.to);
        await mkdir(destDir, { recursive: true });
        const originalTo = action.to;
        const finalPath = await ensureUniquePath(destDir, basename(action.to));
        await rename(action.from, finalPath);
        destinationsSet.add(destDir);
        action.to = finalPath;
        if (originalTo !== finalPath) filePathRemap.set(originalTo, finalPath);
        result.applied++;
      } else if (action.type === "rename") {
        await rename(action.from, action.to);
        result.applied++;
      }
    } catch (e) {
      result.failed.push({ action, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Phase 2: folder moves — record old→new for tag path fixup
  const pathRemap: [string, string][] = [];
  for (const action of folderMoveQueue) {
    try {
      await mkdir(dirname(action.to), { recursive: true });
      if (await pathExists(action.to)) {
        result.failed.push({ action, error: `Destination already exists: ${action.to}` });
        continue;
      }
      await rename(action.from, action.to);
      pathRemap.push([action.from + "/", action.to + "/"]);
      destinationsSet.add(dirname(action.to));
      result.applied++;
    } catch (e) {
      result.failed.push({ action, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Phase 3: tags — fix up paths for files in moved folders
  for (const action of tagQueue) {
    let path = action.path;
    // Apply file-level remap first (ensureUniquePath renaming)
    path = filePathRemap.get(path) ?? path;
    // Then apply folder-level remap (moved folders)
    for (const [oldPrefix, newPrefix] of pathRemap) {
      if (path.startsWith(oldPrefix)) { path = newPrefix + path.slice(oldPrefix.length); break; }
    }
    try {
      await setFinderLabel(path, action.label);
      result.applied++;
    } catch (e) {
      result.failed.push({ action: { ...action, path }, error: e instanceof Error ? e.message : String(e) });
    }
  }

  result.destinations = Array.from(destinationsSet);
  return result;
}
