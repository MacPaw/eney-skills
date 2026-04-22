import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { ffmpegSupportsAss, findFfmpeg, resetFfmpegCache } from "./ffmpeg.js";
import { findWhisperCli } from "./whisper.js";

const BREW_PATHS = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];

export interface Dependencies {
  ffmpeg: boolean;
  whisperCpp: boolean;
  brew: string | null;
}

export async function findBrew(): Promise<string | null> {
  for (const p of BREW_PATHS) if (existsSync(p)) return p;
  return null;
}

export async function checkDependencies(): Promise<Dependencies> {
  resetFfmpegCache();
  const [ffmpegBin, whisperBin, brew] = await Promise.all([
    findFfmpeg(),
    findWhisperCli(),
    findBrew(),
  ]);
  const ffmpeg = ffmpegBin !== null && (await ffmpegSupportsAss());
  return { ffmpeg, whisperCpp: whisperBin !== null, brew };
}

export function installDependencies(
  brew: string,
  current: Dependencies,
  onOutput: (chunk: string) => void,
): Promise<void> {
  const packages: string[] = [];
  if (!current.ffmpeg) packages.push("ffmpeg-full");
  if (!current.whisperCpp) packages.push("whisper-cpp");
  if (packages.length === 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const proc = spawn(brew, ["install", ...packages]);
    proc.stdout?.on("data", (d) => onOutput(d.toString()));
    proc.stderr?.on("data", (d) => onOutput(d.toString()));
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`brew install exited with code ${code}`));
    });
  });
}
