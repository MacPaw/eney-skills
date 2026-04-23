import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { execFile } from "node:child_process";
import matter from "gray-matter";
import { doubleMetaphone } from "double-metaphone";

// --- Vault discovery ---

export interface VaultInfo {
  id: string;
  path: string;
  name: string;
}

export async function loadVaults(): Promise<VaultInfo[]> {
  const configPath = join(
    homedir(),
    "Library",
    "Application Support",
    "obsidian",
    "obsidian.json",
  );
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      vaults?: Record<string, { path: string; ts: number; open?: boolean }>;
    };
    const entries = parsed.vaults ?? {};
    return Object.entries(entries)
      .map(([id, v]) => ({ id, path: v.path, name: basename(v.path) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// --- Note indexing ---

export interface Note {
  absPath: string;
  relPath: string; // relative to vault root
  folder: string; // relative folder (dirname of relPath), "" for root
  title: string; // frontmatter title || filename
  content: string; // markdown body (without frontmatter)
  frontmatter: Record<string, unknown>;
  tags: string[]; // union of frontmatter tags + inline #hashtags
  wikilinks: string[]; // [[targets]]
  mtime: number;
  phonetic: string; // metaphone signature of title + content tokens
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","in","on","at","to","from","for","of",
  "is","are","was","were","be","been","being","it","this","that","these","those",
  "i","you","he","she","we","they","my","your","our","their","its","as","with",
  "by","not","no","do","does","did","so","up","down","out","then","than","have",
  "has","had","will","would","should","could","can","may","might","about","into",
  "over","under","just","also","only","very",
]);

const INLINE_TAG_REGEX = /(^|\s)#([a-zA-Z][a-zA-Z0-9_/-]{1,40})/g;
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export function extractInlineTags(body: string): string[] {
  const out = new Set<string>();
  INLINE_TAG_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_TAG_REGEX.exec(body)) !== null) out.add(m[2]);
  return Array.from(out);
}

export function extractWikilinks(body: string): string[] {
  const out = new Set<string>();
  WIKILINK_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_REGEX.exec(body)) !== null) out.add(m[1].trim());
  return Array.from(out);
}

export function normalizeTags(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map((s) => s.replace(/^#/, "").trim()).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split(/[,\s]+/)
      .map((s) => s.replace(/^#/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function phoneticSignature(s: string): string {
  const tokens = Array.from(new Set(tokenize(s))).slice(0, 200);
  const codes = new Set<string>();
  for (const t of tokens) {
    const [a, b] = doubleMetaphone(t);
    if (a) codes.add(a);
    if (b) codes.add(b);
  }
  return Array.from(codes).join(" ");
}

export function phoneticOf(s: string): string[] {
  const tokens = Array.from(new Set(tokenize(s)));
  const codes = new Set<string>();
  for (const t of tokens) {
    const [a, b] = doubleMetaphone(t);
    if (a) codes.add(a);
    if (b) codes.add(b);
  }
  return Array.from(codes);
}

// Recursive walk — skips .obsidian, .trash, .git, and node_modules
const SKIP_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);

async function walkMarkdown(root: string, current = root): Promise<string[]> {
  const out: string[] = [];
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = await readdir(current, { withFileTypes: true, encoding: "utf-8" });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(current, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkMarkdown(root, full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

export async function readNote(vaultRoot: string, absPath: string): Promise<Note> {
  const raw = await readFile(absPath, "utf-8");
  const parsed = matter(raw);
  const body = parsed.content;
  const fm = (parsed.data ?? {}) as Record<string, unknown>;
  const relPath = relative(vaultRoot, absPath);
  const folder = dirname(relPath) === "." ? "" : dirname(relPath);
  const title =
    (typeof fm.title === "string" && fm.title.trim()) ||
    basename(absPath, ".md");
  const fmTags = normalizeTags(fm.tags ?? fm.tag);
  const inlineTags = extractInlineTags(body);
  const tags = Array.from(new Set([...fmTags, ...inlineTags]));
  const wikilinks = extractWikilinks(body);
  const st = await stat(absPath);
  return {
    absPath,
    relPath,
    folder,
    title,
    content: body,
    frontmatter: fm,
    tags,
    wikilinks,
    mtime: st.mtimeMs,
    phonetic: phoneticSignature(title + "\n" + body.slice(0, 2000)),
  };
}

export async function indexVault(vaultRoot: string, limit = 2000): Promise<Note[]> {
  const paths = await walkMarkdown(vaultRoot);
  const slice = paths.slice(0, limit);
  const notes = await Promise.all(
    slice.map(async (p) => {
      try {
        return await readNote(vaultRoot, p);
      } catch {
        return null;
      }
    }),
  );
  return notes.filter((n): n is Note => n !== null);
}

// --- Auto-folder detection ---

export interface FolderSuggestion {
  folder: string;
  score: number;
  reason: string;
}

export function suggestFolders(
  contentTitle: string,
  contentBody: string,
  notes: Note[],
  top = 3,
): FolderSuggestion[] {
  const contentTokens = new Set(tokenize(contentTitle + " " + contentBody));
  const contentTags = new Set(extractInlineTags(contentBody));

  // Group existing notes by folder
  const folders = new Map<string, { titleTokens: Set<string>; tags: Set<string>; count: number }>();
  for (const n of notes) {
    const key = n.folder || "";
    const bucket = folders.get(key) ?? {
      titleTokens: new Set<string>(),
      tags: new Set<string>(),
      count: 0,
    };
    for (const t of tokenize(n.title)) bucket.titleTokens.add(t);
    for (const tag of n.tags) bucket.tags.add(tag);
    bucket.count++;
    folders.set(key, bucket);
  }

  const suggestions: FolderSuggestion[] = [];
  for (const [folder, bucket] of folders) {
    let titleOverlap = 0;
    for (const t of bucket.titleTokens) if (contentTokens.has(t)) titleOverlap++;
    let tagOverlap = 0;
    for (const tag of bucket.tags) if (contentTags.has(tag)) tagOverlap++;
    const folderNameTokens = new Set(tokenize(folder.replace(/[/\\]/g, " ")));
    let nameOverlap = 0;
    for (const t of folderNameTokens) if (contentTokens.has(t)) nameOverlap++;

    const score = nameOverlap * 3 + tagOverlap * 2 + titleOverlap;
    if (score === 0) continue;
    const reasons: string[] = [];
    if (nameOverlap > 0) reasons.push(`folder name matches ${nameOverlap} keyword${nameOverlap === 1 ? "" : "s"}`);
    if (tagOverlap > 0) reasons.push(`${tagOverlap} shared tag${tagOverlap === 1 ? "" : "s"}`);
    if (titleOverlap > 0) reasons.push(`${titleOverlap} shared title term${titleOverlap === 1 ? "" : "s"}`);
    suggestions.push({
      folder: folder || "(vault root)",
      score,
      reason: reasons.join(", "),
    });
  }
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, top);
}

// --- Helpers ---

export function openInObsidianURI(vaultName: string, filePath: string) {
  const url = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(
    filePath,
  )}`;
  execFile("/usr/bin/open", [url]);
}

export function isoDate(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoDateTime(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildFrontmatter(fm: Record<string, unknown>): string {
  // Minimal YAML serializer — handles strings, numbers, booleans, string arrays.
  // Not a full YAML impl, but sufficient for our keys (title/tags/source/created/updated).
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}: [${v.map((x) => JSON.stringify(String(x))).join(", ")}]`);
    } else if (typeof v === "string") {
      const needsQuote = /[:#\n"'\\]/.test(v);
      lines.push(`${k}: ${needsQuote ? JSON.stringify(v) : v}`);
    } else if (typeof v === "number" || typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    } else {
      // Fall back to JSON for anything else
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function stripFrontmatter(raw: string): { body: string; fm: Record<string, unknown> } {
  const parsed = matter(raw);
  return { body: parsed.content, fm: (parsed.data ?? {}) as Record<string, unknown> };
}

export function snippetAround(content: string, term: string, radius = 80): string {
  if (!term) return content.slice(0, radius * 2);
  const idx = content.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return content.slice(0, radius * 2).replace(/\s+/g, " ").trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + term.length + radius);
  return (
    (start > 0 ? "…" : "") +
    content.slice(start, end).replace(/\s+/g, " ").trim() +
    (end < content.length ? "…" : "")
  );
}

export { sep };
