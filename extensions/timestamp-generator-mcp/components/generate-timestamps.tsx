import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  CardHeader,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import Groq from "groq-sdk";
import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
// @ts-ignore — package "main" points to CJS; import ESM bundle directly
import { YoutubeTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";

const execFileAsync = promisify(execFile);

// ─── Schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  url: z.string().optional().describe("YouTube video URL to generate timestamps for."),
  mode: z.enum(["youtube", "file"]).optional().describe("Input mode: 'youtube' for a URL, 'file' for an uploaded audio/video file."),
});

type Props = z.infer<typeof schema>;
type Mode = "youtube" | "file";

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 24 * 1024 * 1024; // 24 MB — Groq Whisper limit is 25 MB
const CHUNK_SECONDS = 600;                  // 10-minute chunks

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sampleTranscript(lines: string[], maxChars = 4000): string {
  if (lines.length === 1) return lines[0].slice(0, maxChars);
  const full = lines.join("\n");
  if (full.length <= maxChars) return full;
  const keep = Math.max(1, Math.floor((maxChars / full.length) * lines.length));
  const step = lines.length / keep;
  const sampled: string[] = [];
  for (let i = 0; i < keep; i++) sampled.push(lines[Math.round(i * step)]);
  return sampled.join("\n");
}

const TIMESTAMP_PROMPT = (transcript: string) =>
  `Generate YouTube timestamps for the following transcript.
Identify the main topics/sections and output ONLY a list of timestamps in this exact format (no extra text):

0:00 Intro
1:23 Main topic
5:47 Key example

IMPORTANT: Write the topic descriptions in the SAME language as the transcript. Do not translate.
Use the timestamps from the transcript to pick accurate times for each section. Focus on meaningful topic changes. Output only the timestamp list.

Transcript:
${transcript}`;

// ─── ffmpeg helpers ────────────────────────────────────────────────────────

async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

/** Extract audio-only track as mono 16 kHz mp3 at 32 kbps — ideal for speech. */
async function extractAudio(inputPath: string): Promise<string> {
  const outPath = join(tmpdir(), `${randomUUID()}.mp3`);
  await execFileAsync("ffmpeg", [
    "-i", inputPath,
    "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k",
    outPath, "-y",
  ]);
  return outPath;
}

/** Split audio into CHUNK_SECONDS-long pieces, returns paths + start offsets. */
async function splitAudio(
  audioPath: string,
  durationSecs: number,
): Promise<{ path: string; startSecs: number }[]> {
  const chunks: { path: string; startSecs: number }[] = [];
  let start = 0;
  while (start < durationSecs) {
    const outPath = join(tmpdir(), `${randomUUID()}.mp3`);
    await execFileAsync("ffmpeg", [
      "-i", audioPath,
      "-ss", String(start),
      "-t", String(CHUNK_SECONDS),
      "-c", "copy",
      outPath, "-y",
    ]);
    chunks.push({ path: outPath, startSecs: start });
    start += CHUNK_SECONDS;
  }
  return chunks;
}

async function cleanupFiles(paths: string[]): Promise<void> {
  await Promise.allSettled(paths.map((p) => unlink(p)));
}

// ─── Transcription ─────────────────────────────────────────────────────────

type Segment = { start: number; text: string };

async function transcribeChunk(
  groq: Groq,
  filePath: string,
  offsetSecs: number,
): Promise<Segment[]> {
  const transcription = await groq.audio.transcriptions.create({
    model: "whisper-large-v3",
    file: createReadStream(filePath),
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });
  const segs = (transcription as unknown as { segments?: Segment[] }).segments;
  if (segs && segs.length > 0) {
    return segs.map((s) => ({ start: s.start + offsetSecs, text: s.text.trim() }));
  }
  return [{ start: offsetSecs, text: transcription.text }];
}

async function transcribeFile(
  groq: Groq,
  filePath: string,
  onProgress: (msg: string) => void,
): Promise<Segment[]> {
  const tempFiles: string[] = [];

  try {
    onProgress("Extracting audio…");
    const audioPath = await extractAudio(filePath);
    tempFiles.push(audioPath);

    const audioSize = (await stat(audioPath)).size;

    if (audioSize <= MAX_UPLOAD_BYTES) {
      onProgress("Transcribing…");
      return await transcribeChunk(groq, audioPath, 0);
    }

    // File too large — split into chunks
    onProgress("File is large, splitting into chunks…");
    const duration = await getAudioDuration(audioPath);
    const chunks = await splitAudio(audioPath, duration);
    chunks.forEach((c) => tempFiles.push(c.path));

    const allSegments: Segment[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress(`Transcribing chunk ${i + 1} of ${chunks.length}…`);
      const segs = await transcribeChunk(groq, chunks[i].path, chunks[i].startSecs);
      allSegments.push(...segs);
    }
    return allSegments;
  } finally {
    await cleanupFiles(tempFiles);
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

function GenerateTimestamps(props: Props) {
  const closeWidget = useCloseWidget();

  const [mode, setMode] = useState<Mode>(props.mode ?? "youtube");
  const [url, setUrl] = useState(props.url ?? "");
  const [filePath, setFilePath] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [timestamps, setTimestamps] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function generateTimestamps(groq: Groq, formattedTranscript: string): Promise<string> {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [{ role: "user", content: TIMESTAMP_PROMPT(formattedTranscript) }],
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  }

  // ── YouTube mode ──────────────────────────────────────────────────────────

  async function onGenerateFromYouTube() {
    const trimmed = url.trim();
    if (!trimmed || !groqApiKey.trim()) return;

    const videoId = extractVideoId(trimmed);
    if (!videoId) {
      setError("Invalid YouTube URL. Please enter a valid YouTube video URL.");
      return;
    }

    setIsLoading(true);
    setError("");
    setProgress("Fetching transcript…");

    let formattedTranscript: string;
    try {
      const raw = (await YoutubeTranscript.fetchTranscript(videoId)) as {
        text: string;
        offset: number;
      }[];
      const lines = raw.map((item) => `[${formatTimestamp(item.offset / 1000)}] ${item.text}`);
      formattedTranscript = sampleTranscript(lines);
    } catch {
      setError("No transcript available for this video. The video may not have captions enabled.");
      setIsLoading(false);
      setProgress("");
      return;
    }

    try {
      setProgress("Generating timestamps…");
      const groq = new Groq({ apiKey: groqApiKey.trim(), dangerouslyAllowBrowser: true });
      setTimestamps(await generateTimestamps(groq, formattedTranscript));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate timestamps.");
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  }

  // ── File mode ─────────────────────────────────────────────────────────────

  async function onGenerateFromFile() {
    if (!filePath || !groqApiKey.trim()) return;

    setIsLoading(true);
    setError("");
    setProgress("");

    try {
      const groq = new Groq({ apiKey: groqApiKey.trim(), dangerouslyAllowBrowser: true });
      const segments = await transcribeFile(groq, filePath, setProgress);
      const lines = segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`);
      const formattedTranscript = sampleTranscript(lines);

      setProgress("Generating timestamps…");
      setTimestamps(await generateTimestamps(groq, formattedTranscript));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription or timestamp generation failed.");
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  function onStartOver() {
    setTimestamps("");
    setError("");
    setUrl("");
    setFilePath("");
    setProgress("");
  }

  function onDone() {
    closeWidget(timestamps || "Done.");
  }

  const isYouTube = mode === "youtube";
  const canSubmit = !isLoading && !!groqApiKey.trim() && (isYouTube ? !!url.trim() : !!filePath);

  // ── Result view ───────────────────────────────────────────────────────────

  if (timestamps) {
    return (
      <Form
        header={<CardHeader title="Timestamp Generator" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Start Over" onSubmit={onStartOver} style="secondary" />
            <Action.CopyToClipboard content={timestamps} title="Copy" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={"```\n" + timestamps + "\n```"} />
      </Form>
    );
  }

  // ── Input view ────────────────────────────────────────────────────────────

  return (
    <Form
      header={<CardHeader title="Timestamp Generator" iconBundleId="com.apple.QuickTimePlayerX" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? (progress || "Generating…") : "Generate"}
            onSubmit={isYouTube ? onGenerateFromYouTube : onGenerateFromFile}
            style="primary"
            isLoading={isLoading}
            isDisabled={!canSubmit}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {isLoading && progress && <Paper markdown={`_${progress}_`} />}

      <Form.PasswordField
        name="groqApiKey"
        label="Groq API Key"
        value={groqApiKey}
        onChange={setGroqApiKey}
      />

      <Form.Dropdown
        name="mode"
        label="Source"
        value={mode}
        onChange={(v) => { setMode(v as Mode); setError(""); }}
      >
        <Form.Dropdown.Item value="youtube" title="YouTube URL" />
        <Form.Dropdown.Item value="file" title="Upload File" />
      </Form.Dropdown>

      {isYouTube ? (
        <Form.TextField
          name="url"
          label="YouTube Video URL"
          value={url}
          onChange={setUrl}
        />
      ) : (
        <Form.FilePicker
          name="file"
          label="Audio / Video File"
          value={filePath}
          onChange={(v) => setFilePath(Array.isArray(v) ? (v[0] ?? "") : v)}
          accept={["public.mpeg-4", "public.mp3", "com.apple.quicktime-movie", "public.mpeg-4-audio"]}
        />
      )}
    </Form>
  );
}

// ─── Registration ──────────────────────────────────────────────────────────

const GenerateTimestampsWidget = defineWidget({
  name: "generate-timestamps",
  description: "Generate timestamps from a YouTube video URL or an uploaded audio/video file using Groq",
  schema,
  component: GenerateTimestamps,
});

export default GenerateTimestampsWidget;
