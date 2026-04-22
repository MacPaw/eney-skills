import { useEffect, useState } from "react";
import { z } from "zod";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, extname, dirname } from "node:path";
import {
  Action,
  ActionPanel,
  CardHeader,
  defineWidget,
  Files,
  Form,
  Paper,
  useCloseWidget,
} from "@eney/api";
import { runFfmpeg } from "../helpers/ffmpeg.js";
import { ensureWhisperModel, transcribeWithWhisperCpp, WHISPER_MODELS } from "../helpers/whisper.js";

const DEFAULT_MODEL = "small" as const;
import { buildAss } from "../helpers/ass.js";
import { checkDependencies, type Dependencies, installDependencies } from "../helpers/setup.js";
import { openAirDropShare } from "../helpers/airdrop.js";
import { generateCaption, type CaptionDraft } from "../helpers/caption.js";
import { YouTubeUpload } from "./youtube-upload.js";

const schema = z.object({
  source: z.string().optional().describe("The path to the video file to subtitle."),
});

type Props = z.infer<typeof schema>;

function AddVideoSubtitles(props: Props) {
  const closeWidget = useCloseWidget();
  const [source, setSource] = useState<string | undefined>(props.source);
  const [translate, setTranslate] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string>("");
  const [outputs, setOutputs] = useState<string[]>([]);

  const [caption, setCaption] = useState<CaptionDraft | null>(null);
  const [showCaption, setShowCaption] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [captionTitle, setCaptionTitle] = useState("");
  const [captionDescription, setCaptionDescription] = useState("");
  const [captionHashtags, setCaptionHashtags] = useState("");

  const [deps, setDeps] = useState<Dependencies | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installLog, setInstallLog] = useState("");

  useEffect(() => {
    void refreshDeps();
  }, []);

  async function refreshDeps() {
    const next = await checkDependencies();
    setDeps(next);
  }

  async function onInstall() {
    if (!deps?.brew) return;
    setIsInstalling(true);
    setError("");
    setInstallLog("");
    try {
      await installDependencies(deps.brew, deps, (chunk) => setInstallLog((prev) => prev + chunk));
      await refreshDeps();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsInstalling(false);
    }
  }

  async function onSubmit() {
    if (!source) return;
    setError("");
    setOutputs([]);
    setCaption(null);
    setIsWorking(true);

    const workDir = await mkdtemp(join(tmpdir(), "video-subs-"));
    const audioPath = join(workDir, "audio.wav");
    const assPath = join(workDir, "subs.ass");
    const assEnPath = join(workDir, "subs-en.ass");

    const ext = extname(source);
    const stem = basename(source, ext);
    const outPath = join(dirname(source), `${stem}-subtitled.mp4`);
    const outEnPath = join(dirname(source), `${stem}-subtitled-en.mp4`);

    try {
      setStatus("Preparing Whisper model…");
      const modelPath = await ensureWhisperModel(DEFAULT_MODEL, (pct) => {
        setStatus(`Downloading ${WHISPER_MODELS[DEFAULT_MODEL].label}… ${pct}%`);
      });

      setStatus("Extracting audio…");
      await runFfmpeg([
        "-y", "-i", source,
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        audioPath,
      ]);

      setStatus("Transcribing speech (on-device)…");
      const words = await transcribeWithWhisperCpp(audioPath, modelPath);

      setStatus("Generating karaoke subtitles…");
      const ass = buildAss(words);
      await writeFile(assPath, ass, "utf8");

      setStatus("Burning subtitles into video…");
      await runFfmpeg([
        "-y", "-i", source,
        "-vf", `ass=${escapeFilterPath(assPath)}`,
        "-c:a", "copy",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        outPath,
      ]);

      const produced = [outPath];

      if (translate) {
        setStatus("Translating speech to English…");
        const enWords = await transcribeWithWhisperCpp(audioPath, modelPath, { translate: true });

        setStatus("Burning English subtitles…");
        await writeFile(assEnPath, buildAss(enWords), "utf8");
        await runFfmpeg([
          "-y", "-i", source,
          "-vf", `ass=${escapeFilterPath(assEnPath)}`,
          "-c:a", "copy",
          "-c:v", "libx264", "-preset", "fast", "-crf", "20",
          outEnPath,
        ]);
        produced.push(outEnPath);
      }

      setCaption(generateCaption(words));
      setOutputs(produced);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("");
    } finally {
      await cleanup(workDir, [audioPath, assPath, assEnPath]);
      setIsWorking(false);
    }
  }

  function onDone() {
    closeWidget(outputs.length ? `Saved ${outputs.length} video(s).` : "Cancelled.");
  }

  function onAirDrop() {
    const primary = outputs[0];
    if (!primary) return;
    openAirDropShare(primary).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  function onOpenCaption() {
    if (!caption) return;
    setCaptionTitle(caption.title);
    setCaptionDescription(caption.description);
    setCaptionHashtags(caption.hashtags.join(" "));
    setShowCaption(true);
  }

  if (showYouTube && outputs.length > 0) {
    return (
      <YouTubeUpload
        videoPath={outputs[0]}
        caption={caption}
        onBack={() => setShowYouTube(false)}
        onDone={() => { setShowYouTube(false); onDone(); }}
      />
    );
  }

  if (showCaption && caption) {
    const fullCaption = [captionTitle, "", captionDescription, "", captionHashtags]
      .filter((p) => p.length > 0)
      .join("\n");
    return (
      <Form
        header={<CardHeader title="Caption Draft" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={
          <ActionPanel layout="row">
            <Action title="Back" onAction={() => setShowCaption(false)} style="secondary" />
            <Action.CopyToClipboard title="Copy All" content={fullCaption} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown="_Draft suggestions from the transcript — edit before posting. Each field has its own copy button._" />
        <Form.TextField
          name="captionTitle"
          label="Title"
          value={captionTitle}
          onChange={setCaptionTitle}
          isCopyable
        />
        <Form.TextField
          name="captionDescription"
          label="Description"
          value={captionDescription}
          onChange={setCaptionDescription}
          isCopyable
        />
        <Form.TextField
          name="captionHashtags"
          label="Hashtags"
          value={captionHashtags}
          onChange={setCaptionHashtags}
          isCopyable
        />
      </Form>
    );
  }

  if (outputs.length > 0) {
    return (
      <Form
        header={<CardHeader title="Add Video Subtitles" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={
          <ActionPanel>
            <Action title="Upload to YouTube" onAction={() => setShowYouTube(true)} style="secondary" />
            <Action title="AirDrop" onAction={onAirDrop} style="secondary" />
            <Action title="Copy Caption" onAction={onOpenCaption} style="secondary" isDisabled={!caption} />
            <Action.ShowInFinder path={outputs[0]} title="Show in Finder" style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Files>
          {outputs.map((path) => <Files.Item key={path} path={path} />)}
        </Files>
      </Form>
    );
  }

  if (deps && (!deps.ffmpeg || !deps.whisperCpp)) {
    const missing: string[] = [];
    if (!deps.ffmpeg) missing.push("`ffmpeg-full`");
    if (!deps.whisperCpp) missing.push("`whisper-cpp`");

    if (!deps.brew) {
      return (
        <Form
          header={<CardHeader title="Add Video Subtitles" iconBundleId="com.apple.QuickTimePlayerX" />}
          actions={
            <ActionPanel>
              <Action title="Re-check" onAction={refreshDeps} style="primary" />
            </ActionPanel>
          }
        >
          <Paper markdown={`**Homebrew is required** to install the dependencies: ${missing.join(", ")}.\n\nInstall Homebrew from [brew.sh](https://brew.sh), then re-check.`} />
        </Form>
      );
    }

    const logTail = installLog.slice(-2000);
    return (
      <Form
        header={<CardHeader title="Add Video Subtitles" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title={isInstalling ? "Installing…" : `Install ${missing.join(" & ")}`}
              onSubmit={onInstall}
              style="primary"
              isLoading={isInstalling}
              isDisabled={isInstalling}
            />
          </ActionPanel>
        }
      >
        <Paper
          markdown={
            `This extension needs ${missing.join(" and ")} to run fully on-device.\n\n` +
            `Click **Install** to run \`brew install ${missing.map((m) => m.replace(/`/g, "")).join(" ")}\` for you.` +
            (logTail ? `\n\n---\n\n\`\`\`\n${logTail}\n\`\`\`` : "")
          }
        />
        {error && <Paper markdown={`**Error:** ${error}`} />}
      </Form>
    );
  }

  if (!deps) {
    return (
      <Form
        header={<CardHeader title="Add Video Subtitles" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={<ActionPanel><Action title="Checking…" onAction={() => {}} isDisabled={true} /></ActionPanel>}
      >
        <Paper markdown="_Checking dependencies…_" />
      </Form>
    );
  }

  return (
    <Form
      header={<CardHeader title="Add Video Subtitles" iconBundleId="com.apple.QuickTimePlayerX" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isWorking ? (status || "Working…") : "Add Subtitles"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isWorking}
            isDisabled={!source || isWorking}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {isWorking && status && <Paper markdown={`_${status}_`} />}
      <Form.FilePicker
        name="source"
        label="Video"
        value={source}
        onChange={setSource}
      />
      <Form.Checkbox
        name="translate"
        label="Also export an English-translated version"
        checked={translate}
        onChange={setTranslate}
        variant="switch"
      />
      <Paper markdown="Runs fully on-device using Whisper (~466 MB model downloads once on first use) and ffmpeg." />
    </Form>
  );
}

function escapeFilterPath(path: string): string {
  return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

async function cleanup(dir: string, files: string[]): Promise<void> {
  for (const f of files) {
    try { await unlink(f); } catch { /* ignore */ }
  }
  try { await rmdir(dir); } catch { /* ignore */ }
}

const AddVideoSubtitlesWidget = defineWidget({
  name: "add-video-subtitles",
  description: "Add karaoke-style subtitles to a short video by transcribing speech on-device with Whisper and burning styled captions via ffmpeg. Optionally translates to English, AirDrops the result, and drafts a caption.",
  schema,
  component: AddVideoSubtitles,
});

export default AddVideoSubtitlesWidget;
