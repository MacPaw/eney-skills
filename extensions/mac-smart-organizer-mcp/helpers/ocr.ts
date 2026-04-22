import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname, basename } from "node:path";
import { runCommand } from "./run-script.js";

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".heic", ".tiff", ".bmp", ".gif", ".webp",
]);

const SCREENSHOT_PATTERN =
  /^(screenshot|screen[\s_-]shot|screen[\s_-]capture|capture|снимок экрана)/i;

export function isScreenshot(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return false;
  return SCREENSHOT_PATTERN.test(basename(filename, ext));
}

const SWIFT_SCRIPT = `import Vision
import Foundation
import CoreGraphics
import ImageIO

guard CommandLine.arguments.count > 1 else { exit(0) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cg  = CGImageSourceCreateImageAtIndex(src, 0, nil) else { exit(0) }
let req = VNRecognizeTextRequest()
req.recognitionLevel = .fast
req.usesLanguageCorrection = false
try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
let text = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
print(String(text.prefix(600)))
`;

let cachedScriptPath: string | null = null;

async function ensureScript(): Promise<string> {
  if (cachedScriptPath) return cachedScriptPath;
  const p = join(tmpdir(), "eney_ocr.swift");
  await writeFile(p, SWIFT_SCRIPT, "utf8");
  cachedScriptPath = p;
  return p;
}

export async function ocrImage(imagePath: string): Promise<string | undefined> {
  try {
    const script = await ensureScript();
    const text = await runCommand("swift", [script, imagePath]);
    return text.trim() || undefined;
  } catch {
    return undefined;
  }
}
