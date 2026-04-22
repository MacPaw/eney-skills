import { open } from "node:fs/promises";

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".xml",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".log",
  ".html", ".htm", ".rtf", ".srt", ".vtt",
]);

const PREVIEW_BYTES = 1024;

export async function readContentPreview(
  path: string,
  ext: string
): Promise<string | undefined> {
  const lower = ext.toLowerCase();
  if (!TEXT_EXTENSIONS.has(lower)) return undefined;
  let handle = null;
  try {
    handle = await open(path, "r");
    const buffer = Buffer.alloc(PREVIEW_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, PREVIEW_BYTES, 0);
    const text = buffer.subarray(0, bytesRead).toString("utf8");
    return text.replace(/\s+/g, " ").trim().slice(0, 400);
  } catch {
    return undefined;
  } finally {
    await handle?.close();
  }
}
