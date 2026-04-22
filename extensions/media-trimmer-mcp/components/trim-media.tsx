import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, Files, defineWidget, useCloseWidget } from "@eney/api";
import { execFile, spawn } from "child_process";
import { stat } from "node:fs/promises";
import { promisify } from "util";
import path from "path";
import ffmpegBin from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

const execFileAsync = promisify(execFile);
const ffmpeg = ffmpegBin as unknown as string;
const ffprobe = ffprobeStatic.path;

const PRESETS: { label: string; value: string; seconds: number }[] = [
  { label: "TikTok (60s)", value: "tiktok", seconds: 60 },
  { label: "TikTok Short (15s)", value: "tiktok-short", seconds: 15 },
  { label: "Instagram Reel (90s)", value: "reel", seconds: 90 },
  { label: "YouTube Short (60s)", value: "yt-short", seconds: 60 },
  { label: "Story (15s)", value: "story", seconds: 15 },
];

const schema = z.object({
  filePath: z.string().optional().describe("Path to the video or audio file to trim."),
});

type Props = z.infer<typeof schema>;

interface FileInfo {
  duration: number;
  codec: string | null;
  width: number | null;
  height: number | null;
  sizeMB: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}

async function getFileInfo(filePath: string): Promise<FileInfo> {
  const [probeResult, fileStat] = await Promise.all([
    execFileAsync(ffprobe, [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,width,height",
      "-select_streams", "v:0",
      "-of", "json",
      filePath,
    ]),
    stat(filePath),
  ]);

  const parsed = JSON.parse(probeResult.stdout);
  const duration = parseFloat(parsed.format?.duration ?? "0");
  const stream = parsed.streams?.[0];
  const sizeMB = (fileStat.size / (1024 * 1024)).toFixed(1);

  return {
    duration,
    codec: stream?.codec_name ?? null,
    width: stream?.width ?? null,
    height: stream?.height ?? null,
    sizeMB,
  };
}

async function chooseMediaFile(): Promise<string | null> {
  const downloads = path.join(process.env.HOME ?? "~", "Downloads");
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      `POSIX path of (choose file with prompt "Choose a video or audio file" of type {"public.movie", "public.audio", "com.apple.m4a-audio", "public.mp3", "public.mpeg-4-audio"} default location POSIX file "${downloads}")`,
    ]);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function chooseOutputFolder(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e", 'POSIX path of (choose folder with prompt "Choose output folder")',
    ]);
    return stdout.trim();
  } catch {
    return null;
  }
}

function openInSystemPlayer(filePath: string) {
  spawn("open", [filePath], { detached: true, stdio: "ignore" }).unref();
}

function trimMediaWithProgress(
  inputPath: string,
  startSec: number,
  endSec: number,
  outputDir: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    const outputPath = path.join(outputDir, `${base}_trimmed${ext}`);
    const duration = endSec - startSec;

    const proc = spawn(ffmpeg, [
      "-i", inputPath,
      "-ss", formatDuration(startSec),
      "-to", formatDuration(endSec),
      "-c", "copy",
      "-progress", "pipe:1",
      "-y",
      outputPath,
    ]);

    let stdout = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      const match = stdout.match(/out_time_ms=(\d+)/g);
      if (match) {
        const last = match[match.length - 1];
        const ms = parseInt(last.split("=")[1], 10);
        const pct = Math.min(100, Math.round((ms / 1000 / duration) * 100));
        onProgress(pct);
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });

    proc.on("error", reject);
  });
}

function buildFileInfoMd(info: FileInfo): string {
  const parts = [
    `Duration: **${formatDuration(info.duration)}** (${Math.floor(info.duration)}s)`,
  ];
  if (info.width && info.height) parts.push(`${info.width}×${info.height}`);
  if (info.codec) parts.push(info.codec.toUpperCase());
  parts.push(`${info.sizeMB} MB`);
  return parts.join(" · ");
}

function TrimMedia(props: Props) {
  const closeWidget = useCloseWidget();

  const [filePath, setFilePath] = useState<string | undefined>(props.filePath);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const [startSec, setStartSec] = useState<number | null>(0);
  const [endSec, setEndSec] = useState<number | null>(null);
  const [preset, setPreset] = useState("custom");

  const [outputFolder, setOutputFolder] = useState(
    process.env.HOME ? path.join(process.env.HOME, "Downloads") : "/tmp"
  );

  const [showPath, setShowPath] = useState(false);
  const [trimProgress, setTrimProgress] = useState<number | null>(null);
  const [outputPath, setOutputPath] = useState("");
  const [trimError, setTrimError] = useState("");

  async function onChooseFile() {
    const file = await chooseMediaFile();
    if (!file) return;

    setFilePath(file);
    setFileInfo(null);
    setTrimError("");
    setOutputPath("");
    setStartSec(0);
    setEndSec(null);
    setPreset("custom");
    setIsLoadingFile(true);

    const info = await getFileInfo(file).catch(() => null);
    setIsLoadingFile(false);

    if (info) {
      setFileInfo(info);
      setStartSec(0);
      setEndSec(Math.floor(info.duration));
    }
  }

  function onPresetChange(value: string) {
    setPreset(value);
    const found = PRESETS.find((p) => p.value === value);
    if (!found || !fileInfo) return;
    const start = startSec ?? 0;
    setEndSec(Math.min(start + found.seconds, Math.floor(fileInfo.duration)));
  }

  function onStartChange(v: number | null) {
    setStartSec(v);
    const found = PRESETS.find((p) => p.value === preset);
    if (found && v !== null && fileInfo) {
      setEndSec(Math.min(v + found.seconds, Math.floor(fileInfo.duration)));
    }
  }

  function onEndChange(v: number | null) {
    setEndSec(v);
    const found = PRESETS.find((p) => p.value === preset);
    if (found && v !== null) {
      setStartSec(Math.max(0, v - found.seconds));
    }
  }

  async function onChooseFolder() {
    const folder = await chooseOutputFolder();
    if (folder) setOutputFolder(folder);
  }

  async function onTrim() {
    if (!filePath || startSec === null || endSec === null || !fileInfo) return;
    setTrimProgress(0);
    setTrimError("");
    try {
      const result = await trimMediaWithProgress(
        filePath, startSec, endSec, outputFolder,
        (pct) => setTrimProgress(pct),
      );
      setOutputPath(result);
    } catch (e) {
      setTrimError(e instanceof Error ? e.message : String(e));
    } finally {
      setTrimProgress(null);
    }
  }

  function onReset() {
    setOutputPath("");
    setFilePath(undefined);
    setFileInfo(null);
    setStartSec(0);
    setEndSec(null);
    setPreset("custom");
    setTrimProgress(null);
    setTrimError("");
  }

  const isVideo = fileInfo ? fileInfo.width !== null : null;
  const mediaIcon = isVideo === null ? "" : isVideo ? "🎬" : "🎵";

  // Result screen
  if (outputPath) {
    return (
      <Form
        actions={
          <ActionPanel layout="row">
            <Action.ShowInFinder path={outputPath} title="Show in Finder" />
            <Action.SubmitForm title="Trim Another" onSubmit={onReset} style="secondary" />
            <Action title="Done" onAction={() => closeWidget("Trimmed successfully.")} style="primary" />
          </ActionPanel>
        }
      >
        <Files>
          <Files.Item path={outputPath} />
        </Files>
      </Form>
    );
  }

  const isTrimming = trimProgress !== null;
  const maxSec = fileInfo ? Math.floor(fileInfo.duration) : undefined;
  const canTrim = !!filePath && startSec !== null && endSec !== null && endSec > startSec && !isTrimming && !isLoadingFile;

  const folderName = path.basename(outputFolder);

  return (
    <Form
      actions={
        <ActionPanel layout="column">
          {filePath && (
            <Action
              title={`${mediaIcon} ${path.basename(filePath)}`}
              onAction={() => openInSystemPlayer(filePath)}
              style="secondary"
              isDisabled={isTrimming}
            />
          )}
          {filePath
            ? <Action title="Change File" onAction={onChooseFile} style="secondary" isDisabled={isTrimming} />
            : <Action title="Choose File" onAction={onChooseFile} style="primary" isDisabled={isTrimming} />
          }
          <Action title="Choose Save Location" onAction={onChooseFolder} style="secondary" isDisabled={isTrimming} />
          {canTrim && (
            <Action.SubmitForm
              title={isTrimming ? `Trimming… ${trimProgress}%` : "Trim"}
              onSubmit={onTrim}
              style="primary"
              isLoading={isTrimming}
              isDisabled={!canTrim}
            />
          )}
        </ActionPanel>
      }
    >
      {trimError && <Paper markdown={`**Error:** ${trimError}`} />}
      {filePath
        ? <Paper markdown={`${mediaIcon} **${path.basename(filePath)}**`} />
        : <Paper markdown="No file selected — use **Choose File** below to get started." />
      }
      {isLoadingFile && <Paper markdown="Loading file info…" />}
      {!isLoadingFile && fileInfo && <Paper markdown={buildFileInfoMd(fileInfo)} />}
      {!isLoadingFile && fileInfo && (
        <Form.Dropdown name="preset" label="Preset" value={preset} onChange={onPresetChange}>
          <Form.Dropdown.Item value="custom" title="Custom" />
          {PRESETS.map((p) => (
            <Form.Dropdown.Item key={p.value} value={p.value} title={p.label} />
          ))}
        </Form.Dropdown>
      )}
      {!isLoadingFile && fileInfo && (
        <>
          <Form.NumberField
            name="start"
            label="Start (seconds)"
            value={startSec}
            min={0}
            max={maxSec}
            onChange={onStartChange}
          />
          {startSec !== null && <Paper markdown={`→ ${formatDuration(startSec)}`} />}
          <Form.NumberField
            name="end"
            label="End (seconds)"
            value={endSec}
            min={0}
            max={maxSec}
            onChange={onEndChange}
          />
          {endSec !== null && <Paper markdown={`→ ${formatDuration(endSec)}`} />}
        </>
      )}
      <Form.Checkbox
        name="showPath"
        label="Show save location"
        checked={showPath}
        onChange={setShowPath}
        variant="switch"
      />
      <Paper markdown={showPath
        ? `📁 **${folderName}**\n\`${outputFolder}\``
        : `📁 **${folderName}** \`••••••\``
      } />
    </Form>
  );
}

const TrimMediaWidget = defineWidget({
  name: "trim-media",
  description: "Trim video or audio files by selecting start and end points",
  schema,
  component: TrimMedia,
});

export default TrimMediaWidget;
