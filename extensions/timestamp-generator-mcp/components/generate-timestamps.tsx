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
// @ts-ignore — package "main" points to CJS; import ESM bundle directly
import { YoutubeTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";

// ─── Schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  url: z.string().optional().describe("YouTube video URL to generate timestamps for."),
  mode: z.enum(["youtube", "file"]).optional().describe("Input mode: 'youtube' for a URL, 'file' for an uploaded audio/video file."),
});

type Props = z.infer<typeof schema>;
type Mode = "youtube" | "file";

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
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Keep the transcript under ~12 000 chars by sampling evenly across the full video
function sampleTranscript(lines: string[], maxChars = 12000): string {
  const full = lines.join("\n");
  if (full.length <= maxChars) return full;
  // Pick evenly-spaced lines so we cover the whole video
  const keep = Math.floor((maxChars / full.length) * lines.length);
  const step = lines.length / keep;
  const sampled: string[] = [];
  for (let i = 0; i < keep; i++) {
    sampled.push(lines[Math.round(i * step)]);
  }
  return sampled.join("\n");
}

const TIMESTAMP_PROMPT = (transcript: string) =>
  `Generate YouTube timestamps for the following transcript.
Identify the main topics/sections and output ONLY a list of timestamps in this exact format (no extra text):

0:00 Intro
1:23 Main topic
5:47 Key example

Use the timestamps from the transcript to pick accurate times for each section. Focus on meaningful topic changes. Output only the timestamp list.

Transcript:
${transcript}`;

// ─── Component ─────────────────────────────────────────────────────────────

function GenerateTimestamps(props: Props) {
  const closeWidget = useCloseWidget();

  const [mode, setMode] = useState<Mode>(props.mode ?? "youtube");
  const [url, setUrl] = useState(props.url ?? "");
  const [filePath, setFilePath] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [timestamps, setTimestamps] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Shared: generate timestamps from a formatted transcript ───────────────

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
      return;
    }

    try {
      const groq = new Groq({ apiKey: groqApiKey.trim(), dangerouslyAllowBrowser: true });
      setTimestamps(await generateTimestamps(groq, formattedTranscript));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate timestamps.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── File mode ─────────────────────────────────────────────────────────────

  async function onGenerateFromFile() {
    if (!filePath || !groqApiKey.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const groq = new Groq({ apiKey: groqApiKey.trim(), dangerouslyAllowBrowser: true });

      const transcription = await groq.audio.transcriptions.create({
        model: "whisper-large-v3",
        file: createReadStream(filePath),
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      const segments = (transcription as unknown as {
        segments?: { start: number; text: string }[];
      }).segments;

      const lines = segments && segments.length > 0
        ? segments.map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text.trim()}`)
        : [transcription.text];
      const formattedTranscript = sampleTranscript(lines);

      setTimestamps(await generateTimestamps(groq, formattedTranscript));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription or timestamp generation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  function onStartOver() {
    setTimestamps("");
    setError("");
    setUrl("");
    setFilePath("");
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
            title={isLoading ? "Generating…" : "Generate"}
            onSubmit={isYouTube ? onGenerateFromYouTube : onGenerateFromFile}
            style="primary"
            isLoading={isLoading}
            isDisabled={!canSubmit}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
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

      <Form.PasswordField
        name="groqApiKey"
        label="Groq API Key"
        value={groqApiKey}
        onChange={setGroqApiKey}
      />
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
