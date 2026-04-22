import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

// ffmpeg-full (keg-only) ships with libass; preferred. Falls back to plain ffmpeg
// which may lack libass — we verify capability separately.
const FFMPEG_PATHS = [
  "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
  "/usr/local/opt/ffmpeg-full/bin/ffmpeg",
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/opt/local/bin/ffmpeg",
  "/usr/bin/ffmpeg",
];

let cachedPath: string | null | undefined;
let cachedHasAss: boolean | undefined;

export function resetFfmpegCache(): void {
  cachedPath = undefined;
  cachedHasAss = undefined;
}

export async function findFfmpeg(): Promise<string | null> {
  if (cachedPath !== undefined) return cachedPath;
  for (const p of FFMPEG_PATHS) {
    if (existsSync(p)) {
      cachedPath = p;
      return cachedPath;
    }
  }
  const which = await runCapture("/bin/sh", ["-lc", "command -v ffmpeg"]);
  if (which.code === 0 && which.stdout.trim()) {
    cachedPath = which.stdout.trim();
    return cachedPath;
  }
  cachedPath = null;
  return null;
}

export async function ffmpegSupportsAss(): Promise<boolean> {
  if (cachedHasAss !== undefined) return cachedHasAss;
  const bin = await findFfmpeg();
  if (!bin) return false;
  const result = await runCapture(bin, ["-hide_banner", "-filters"]);
  cachedHasAss = /^\s*\S+\s+ass\s+/m.test(result.stdout);
  return cachedHasAss;
}

export async function runFfmpeg(args: string[]): Promise<void> {
  const bin = await findFfmpeg();
  if (!bin) throw new Error("ffmpeg not found. Install with: brew install ffmpeg-full");
  const result = await runCapture(bin, args);
  if (result.code !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr.split("\n").slice(-5).join("\n").trim()}`);
  }
}

function runCapture(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", () => resolve({ code: 1, stdout, stderr: stderr || "spawn error" }));
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
