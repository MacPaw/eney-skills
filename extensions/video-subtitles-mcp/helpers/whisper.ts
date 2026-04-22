import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { TranscribedWord } from "./types.js";

export type WhisperModelId = "base" | "small" | "medium";

export interface WhisperModelInfo {
  id: WhisperModelId;
  label: string;
  fileName: string;
  sizeMb: number;
}

export const WHISPER_MODELS: Record<WhisperModelId, WhisperModelInfo> = {
  base: { id: "base", label: "Fast (142 MB)", fileName: "ggml-base.bin", sizeMb: 142 },
  small: { id: "small", label: "Balanced (466 MB) — recommended", fileName: "ggml-small.bin", sizeMb: 466 },
  medium: { id: "medium", label: "Accurate (1.5 GB)", fileName: "ggml-medium.bin", sizeMb: 1500 },
};

const MODEL_DIR = join(homedir(), ".cache", "eney-skills", "whisper-models");

const WHISPER_PATHS = [
  "/opt/homebrew/bin/whisper-cli",
  "/usr/local/bin/whisper-cli",
];

export async function findWhisperCli(): Promise<string | null> {
  for (const p of WHISPER_PATHS) if (existsSync(p)) return p;
  return null;
}

export async function ensureWhisperModel(
  modelId: WhisperModelId,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const model = WHISPER_MODELS[modelId];
  const modelPath = join(MODEL_DIR, model.fileName);
  if (existsSync(modelPath)) return modelPath;
  await mkdir(MODEL_DIR, { recursive: true });
  const tmpPath = `${modelPath}.part`;
  const modelUrl = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${model.fileName}`;

  const res = await fetch(modelUrl);
  if (!res.ok || !res.body) throw new Error(`Failed to download model (${res.status})`);

  const total = Number(res.headers.get("content-length") ?? 0);
  const { createWriteStream } = await import("node:fs");
  const out = createWriteStream(tmpPath);
  let received = 0;
  let lastReport = -1;

  try {
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise<void>((resolve, reject) => {
        out.write(value, (err) => (err ? reject(err) : resolve()));
      });
      received += value.length;
      if (total && onProgress) {
        const pct = Math.floor((received / total) * 100);
        if (pct !== lastReport) {
          lastReport = pct;
          onProgress(pct);
        }
      }
    }
  } finally {
    await new Promise<void>((resolve) => out.end(() => resolve()));
  }

  await rename(tmpPath, modelPath);
  return modelPath;
}

interface WhisperJson {
  transcription?: Array<{
    offsets?: { from: number; to: number };
    text?: string;
  }>;
}

export interface TranscribeOptions {
  translate?: boolean;
}

export async function transcribeWithWhisperCpp(
  audioPath: string,
  modelPath: string,
  options: TranscribeOptions = {},
): Promise<TranscribedWord[]> {
  const cli = await findWhisperCli();
  if (!cli) throw new Error("whisper-cli not found. Install with: brew install whisper-cpp");

  const suffix = options.translate ? ".en" : "";
  const outPrefix = audioPath.replace(/\.[^.]+$/, "") + suffix;
  const jsonPath = `${outPrefix}.json`;

  await runProcess(cli, [
    "-m", modelPath,
    "-f", audioPath,
    "-ml", "1",
    "-sow",
    "-ojf",
    "-of", outPrefix,
    "-np",
    ...(options.translate ? ["-tr"] : []),
    "-l", "auto",
  ]);

  const raw = await readFile(jsonPath, "utf8");
  await unlink(jsonPath).catch(() => {});

  const data = JSON.parse(raw) as WhisperJson;
  const words: TranscribedWord[] = [];
  for (const seg of data.transcription ?? []) {
    const text = (seg.text ?? "").trim();
    if (!text) continue;
    const offsets = seg.offsets;
    if (!offsets) continue;
    words.push({ word: text, start: offsets.from / 1000, end: offsets.to / 1000 });
  }
  if (words.length === 0) throw new Error("No speech detected in the video.");
  return words;
}

function runProcess(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: dirname(cmd) });
    let stderr = "";
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`whisper-cli failed (${code}): ${stderr.split("\n").slice(-5).join("\n").trim()}`));
    });
  });
}
