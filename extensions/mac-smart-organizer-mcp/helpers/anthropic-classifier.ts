import Anthropic from "@anthropic-ai/sdk";
import type { SubdirectoryInfo } from "./organizer.js";

const SYSTEM_PROMPT = `You organize macOS files into folders.

For each file, choose a destination folder name:
- If an existing folder is a good fit, use its EXACT name (case-sensitive).
- Otherwise propose a short descriptive name (1–3 words, Title Case, no slashes or special characters).
- Prefer specific over generic ("Tax Returns" over "Documents", "Design Mockups" over "Files").
- For screenshots: use the OCR text preview to determine what the screenshot shows, then pick a meaningful folder (e.g. "Invoices", "Code", "Maps").
- A file that doesn't fit any meaningful folder should get folder "Other".

Respond ONLY with JSON: {"classifications": [{"filename": "...", "folder": "..."}]}.`;

interface FileInput {
  filename: string;
  extension: string;
  sizeBytes: number;
  contentPreview?: string;
}

interface ClassifyOptions {
  apiKey: string;
  model?: string;
  files: FileInput[];
  existingFolders?: string[];
  onProgress?: (done: number, total: number) => void;
}

interface FolderClassifyOptions {
  apiKey: string;
  model?: string;
  folders: SubdirectoryInfo[];
  existingFolders?: string[];
}

function buildUserPrompt(batch: FileInput[], existingFolders: string[]): string {
  const folderHint = existingFolders.length > 0
    ? `Existing folders: ${existingFolders.join(", ")}\n\n`
    : "";
  const entries = batch.map((f, i) => {
    const preview = f.contentPreview
      ? ` | preview: ${JSON.stringify(f.contentPreview.slice(0, 400))}`
      : "";
    return `${i + 1}. filename: ${JSON.stringify(f.filename)} | ext: ${f.extension || "(none)"} | size: ${f.sizeBytes}B${preview}`;
  });
  return `${folderHint}Classify ${batch.length} file${batch.length === 1 ? "" : "s"}:\n\n${entries.join("\n")}\n\nReturn JSON: {"classifications": [{"filename", "folder"}]}.`;
}

function extractJson(text: string): unknown {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function parseClassifications(
  raw: string,
  batch: FileInput[]
): Record<string, string> {
  const filenames = new Set(batch.map((f) => f.filename));
  const result: Record<string, string> = {};
  const parsed = extractJson(raw) as { classifications?: unknown[] } | null;
  if (!parsed || !Array.isArray(parsed.classifications)) return result;
  for (const item of parsed.classifications) {
    const rec = item as Record<string, unknown>;
    const filename = typeof rec.filename === "string" ? rec.filename : null;
    const folder = typeof rec.folder === "string" ? rec.folder.trim() : null;
    if (!filename || !folder || !filenames.has(filename)) continue;
    result[filename] = folder;
  }
  return result;
}

export async function classifyWithAnthropic(
  options: ClassifyOptions
): Promise<Record<string, string>> {
  const { apiKey, files, existingFolders = [], onProgress } = options;
  const model = options.model ?? "claude-haiku-4-5";
  const client = new Anthropic({ apiKey, timeout: 60_000 });
  const BATCH_SIZE = 25;
  const results: Record<string, string> = {};

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserPrompt(batch, existingFolders) }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    Object.assign(results, parseClassifications(text, batch));
    onProgress?.(Math.min(i + BATCH_SIZE, files.length), files.length);
  }
  return results;
}

const FOLDER_SYSTEM_PROMPT = `You group related folders under parent folders on macOS.

For each folder, decide its placement:
- If it clearly belongs with similar folders under a shared parent, return a parent folder name (Title Case, 1–3 words).
- If it is fine at root level on its own, return "keep".
- Group when there is a clear relationship: same project/app, numbered series, same topic area.
- Don't over-group — "keep" is the right answer when folders are distinct or unrelated.

Respond ONLY with JSON: {"groupings": [{"folder": "...", "parent": "..."}]}.`;

function parseFolderGroupings(
  raw: string,
  folders: SubdirectoryInfo[]
): Record<string, string> {
  const names = new Set(folders.map((f) => f.name));
  const result: Record<string, string> = {};
  const parsed = extractJson(raw) as { groupings?: unknown[] } | null;
  if (!parsed || !Array.isArray(parsed.groupings)) return result;
  for (const item of parsed.groupings) {
    const rec = item as Record<string, unknown>;
    const folder = typeof rec.folder === "string" ? rec.folder : null;
    const parent = typeof rec.parent === "string" ? rec.parent.trim() : null;
    if (!folder || !parent || !names.has(folder)) continue;
    if (parent !== "keep") result[folder] = parent;
  }
  return result;
}

export async function classifyFoldersWithAnthropic(
  options: FolderClassifyOptions
): Promise<Record<string, string>> {
  const { apiKey, folders, existingFolders = [] } = options;
  const model = options.model ?? "claude-haiku-4-5";
  const client = new Anthropic({ apiKey, timeout: 60_000 });
  const folderHint = existingFolders.length > 0
    ? `Existing root folders: ${existingFolders.join(", ")}\n\n`
    : "";
  const entries = folders.map((f, i) => {
    const sample = f.sampleFiles.length > 0
      ? ` | files: ${f.sampleFiles.slice(0, 5).join(", ")}`
      : "";
    return `${i + 1}. folder: ${JSON.stringify(f.name)} | ${f.fileCount} files${sample}`;
  });
  const userPrompt = `${folderHint}Group the following ${folders.length} folder${folders.length === 1 ? "" : "s"}:\n\n${entries.join("\n")}\n\nReturn JSON: {"groupings": [{"folder", "parent"}]}.`;
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: [{ type: "text", text: FOLDER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseFolderGroupings(text, folders);
}

export function mapAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Invalid API key.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limit reached — try again in a moment.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach Anthropic API — check your connection.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
