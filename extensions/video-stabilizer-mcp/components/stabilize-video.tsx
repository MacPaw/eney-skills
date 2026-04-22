import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Files, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { spawn } from "child_process";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import path from "path";

const schema = z.object({
  inputPath: z.string().optional().describe("Path to the input video file to stabilize."),
  strength: z.number().optional().describe("Stabilization strength from 1 (subtle) to 10 (aggressive). Default is 5."),
});

type Props = z.infer<typeof schema>;
type FfmpegStatus = "checking" | "missing" | "installing" | "vidstab-missing" | "reinstalling" | "ready";

const EXTENDED_PATH = `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`;
const SPAWN_ENV = { ...process.env, PATH: EXTENDED_PATH };

function spawnAsync(cmd: string, args: string[], onStderr?: (chunk: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env: SPAWN_ENV });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => {
      const chunk = d.toString();
      output += chunk;
      onStderr?.(chunk);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}.\n${output.slice(-800)}`));
    });
    proc.on("error", (e) => reject(new Error(`Failed to run ${cmd}: ${e.message}`)));
  });
}

function parseFfmpegProgress(label: string, chunk: string, setProgress: (s: string) => void) {
  for (const line of chunk.split(/[\r\n]/)) {
    const m = line.match(/frame=\s*(\d+)\s+fps=\s*([\d.]+).*time=([\d:.]+)/);
    if (m) setProgress(`${label} — frame ${m[1]}, ${m[2]} fps, ${m[3]}`);
  }
}

const FFMPEG_CANDIDATES = [
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "ffmpeg",
];

function ffmpegExistsAt(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(bin, ["-version"], { env: SPAWN_ENV });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

function vidstabAvailableAt(bin: string): Promise<boolean> {
  // Method 1: scan the full filter list
  const viaFilterList = new Promise<boolean>((resolve) => {
    const proc = spawn(bin, ["-hide_banner", "-filters"], { env: SPAWN_ENV });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => resolve(out.includes("vidstabdetect")));
    proc.on("error", () => resolve(false));
  });

  // Method 2: actually run the filter; only fail if IT SPECIFICALLY is missing
  const viaRunTest = new Promise<boolean>((resolve) => {
    const proc = spawn(bin, [
      "-hide_banner",
      "-f", "lavfi", "-i", "nullsrc=s=16x16:d=0.1",
      "-vf", "vidstabdetect=result=/dev/null",
      "-f", "null", "-",
    ], { env: SPAWN_ENV });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", () => resolve(!stderr.includes("No such filter: 'vidstabdetect'")));
    proc.on("error", () => resolve(false));
  });

  // Available if either method says yes
  return Promise.all([viaFilterList, viaRunTest]).then(([a, b]) => a || b);
}

type FfmpegScanResult = { bin: string; vidstab: boolean };

async function scanFfmpegCandidates(): Promise<FfmpegScanResult[]> {
  const results: FfmpegScanResult[] = [];
  for (const bin of FFMPEG_CANDIDATES) {
    if (await ffmpegExistsAt(bin)) {
      results.push({ bin, vidstab: await vidstabAvailableAt(bin) });
    }
  }
  return results;
}

async function findFfmpegWithVidstab(): Promise<string | null> {
  const results = await scanFfmpegCandidates();
  return results.find((r) => r.vidstab)?.bin ?? null;
}

function strengthToVidstabParams(strength: number): { shakiness: number; smoothing: number } {
  return {
    shakiness: strength,
    smoothing: Math.round(strength * 3),
  };
}

function strengthToDeshakeShift(strength: number): number {
  return Math.min(64, Math.max(16, Math.round((strength / 10) * 4) * 16));
}

function outputFor(inputPath: string): string {
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  return path.join(dir, `${basename}_stabilized${ext}`);
}

function StabilizeVideo(props: Props) {
  const closeWidget = useCloseWidget();
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus>("checking");
  const [ffmpegBin, setFfmpegBin] = useState("ffmpeg");
  const [deshakeFallback, setDeshakeFallback] = useState(false);
  const [actionError, setActionError] = useState("");
  const [installProgress, setInstallProgress] = useState("");
  const [inputPaths, setInputPaths] = useState<string[]>(props.inputPath ? [props.inputPath] : []);
  const [outputPath, setOutputPath] = useState("");
  const [strength, setStrength] = useState<number | null>(props.strength ?? 5);
  const [results, setResults] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    scanFfmpegCandidates().then((scan) => {
      if (scan.length === 0) { setFfmpegStatus("missing"); return; }
      const withVidstab = scan.find((r) => r.vidstab);
      if (withVidstab) { setFfmpegBin(withVidstab.bin); setFfmpegStatus("ready"); return; }
      setFfmpegStatus("vidstab-missing");
    });
  }, []);

  async function onInstall() {
    setFfmpegStatus("installing");
    setActionError("");
    try {
      await spawnAsync("brew", ["install", "ffmpeg"]);
      const bin = await findFfmpegWithVidstab();
      if (bin) { setFfmpegBin(bin); setFfmpegStatus("ready"); }
      else setFfmpegStatus("vidstab-missing");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      setFfmpegStatus("missing");
    }
  }

  async function onReinstall() {
    setFfmpegStatus("reinstalling");
    setActionError("");
    try {
      setInstallProgress("Reinstalling ffmpeg…");
      await spawnAsync("brew", ["reinstall", "ffmpeg"]);

      let bin = await findFfmpegWithVidstab();

      if (!bin) {
        setInstallProgress("Installing libvidstab…");
        await spawnAsync("brew", ["install", "libvidstab"]);
        setInstallProgress("Reinstalling ffmpeg with libvidstab…");
        await spawnAsync("brew", ["reinstall", "ffmpeg"]);
        bin = await findFfmpegWithVidstab();
      }

      if (!bin) {
        setInstallProgress("Installing ffmpeg-full (includes all codecs)…");
        await spawnAsync("brew", ["install", "ffmpeg-full"]);
        await spawnAsync("brew", ["unlink", "ffmpeg"]).catch(() => {});
        await spawnAsync("brew", ["link", "ffmpeg-full", "--force"]);
        bin = await findFfmpegWithVidstab();
      }

      if (bin) {
        setFfmpegBin(bin);
        setFfmpegStatus("ready");
      } else {
        // Couldn't get vidstab — fall back to deshake so the skill still works
        const scan = await scanFfmpegCandidates();
        const existingBin = scan[0]?.bin ?? "ffmpeg";
        setFfmpegBin(existingBin);
        setDeshakeFallback(true);
        setFfmpegStatus("ready");
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      setFfmpegStatus("vidstab-missing");
    } finally {
      setInstallProgress("");
    }
  }

  function onCancel() {
    closeWidget("ffmpeg is required to stabilize videos. Skill cancelled.");
  }

  async function onStabilize(useVidstab: boolean) {
    if (inputPaths.length === 0) return;
    setIsLoading(true);
    setError("");
    setProgress("");

    const outputs: string[] = [];
    const trfFile = path.join(tmpdir(), `vidstab-${randomUUID()}.trf`);

    try {
      for (let i = 0; i < inputPaths.length; i++) {
        const input = inputPaths[i];
        const isSingle = inputPaths.length === 1;
        const output = isSingle && outputPath.trim() ? outputPath.trim() : outputFor(input);
        const fileLabel = inputPaths.length > 1 ? ` (${i + 1}/${inputPaths.length})` : "";

        if (useVidstab) {
          const { shakiness, smoothing } = strengthToVidstabParams(strength ?? 5);
          const label1 = `Pass 1/2: Detecting motion${fileLabel}`;
          setProgress(`${label1}…`);
          await spawnAsync(ffmpegBin, [
            "-i", input,
            "-vf", `vidstabdetect=shakiness=${shakiness}:accuracy=15:result=${trfFile}`,
            "-f", "null", "-",
          ], (chunk) => parseFfmpegProgress(label1, chunk, setProgress));
          const label2 = `Pass 2/2: Applying stabilization${fileLabel}`;
          setProgress(`${label2}…`);
          await spawnAsync(ffmpegBin, [
            "-i", input,
            "-vf", `vidstabtransform=input=${trfFile}:smoothing=${smoothing}:optzoom=1,unsharp=5:5:0.8:3:3:0.4`,
            "-y", output,
          ], (chunk) => parseFfmpegProgress(label2, chunk, setProgress));
        } else {
          const shift = strengthToDeshakeShift(strength ?? 5);
          const label = `Stabilizing${fileLabel}`;
          setProgress(`${label}…`);
          await spawnAsync(ffmpegBin, [
            "-i", input, "-vf", `deshake=rx=${shift}:ry=${shift}`, "-y", output,
          ], (chunk) => parseFfmpegProgress(label, chunk, setProgress));
        }

        outputs.push(output);
      }
      setResults(outputs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
      setProgress("");
      unlink(trfFile).catch(() => {});
    }
  }

  function onDone() {
    closeWidget(results.length === 1
      ? `Stabilized video saved to: ${results[0]}`
      : `${results.length} videos stabilized.`
    );
  }

  function onTryAgain() {
    setResults([]);
    setInputPaths([]);
    setOutputPath("");
    setStrength(5);
    setError("");
  }

  if (ffmpegStatus === "checking") {
    return (
      <Form actions={<ActionPanel><Action title="Cancel" onAction={onCancel} style="secondary" /></ActionPanel>}>
        <Paper markdown="Checking for ffmpeg…" />
      </Form>
    );
  }

  if (ffmpegStatus === "missing" || ffmpegStatus === "installing") {
    const isInstalling = ffmpegStatus === "installing";
    return (
      <Form
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={onCancel} style="secondary" />
            <Action.SubmitForm
              title={isInstalling ? "Installing…" : "Install via Homebrew"}
              onSubmit={onInstall}
              style="primary"
              isLoading={isInstalling}
              isDisabled={isInstalling}
            />
          </ActionPanel>
        }
      >
        {actionError && <Paper markdown={`**Installation failed:**\n\n${actionError}`} />}
        <Paper markdown="**ffmpeg is required** to stabilize videos.\n\nffmpeg was not found on your system. Install it via Homebrew to continue — this may take a few minutes." />
      </Form>
    );
  }

  if (ffmpegStatus === "vidstab-missing" || ffmpegStatus === "reinstalling") {
    const isReinstalling = ffmpegStatus === "reinstalling";
    return (
      <Form
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={onCancel} style="secondary" />
            <Action.SubmitForm
              title={isReinstalling ? "Reinstalling…" : "Reinstall ffmpeg"}
              onSubmit={onReinstall}
              style="primary"
              isLoading={isReinstalling}
              isDisabled={isReinstalling}
            />
          </ActionPanel>
        }
      >
        {actionError
          ? <Paper markdown={`**Reinstall failed:**\n\n${actionError}`} />
          : installProgress
            ? <Paper markdown={installProgress} />
            : <Paper markdown="**Your ffmpeg is missing vidstab support**, which is required for high-quality stabilization.\n\nReinstall ffmpeg to enable it. If the pre-built package lacks vidstab, it will automatically build from source (~20–30 min)." />
        }
      </Form>
    );
  }

  if (results.length > 0) {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm onSubmit={onTryAgain} title="Try Again" style="secondary" />
            <Action.ShowInFinder path={results[0]} title="Show in Finder" style="secondary" />
            <Action.SubmitForm onSubmit={onDone} title="Done" style="primary" />
          </ActionPanel>
        }
      >
        <Files>
          {results.map((r) => <Files.Item key={r} path={r} />)}
        </Files>
        <Paper markdown={results.length === 1
          ? `Stabilized video saved to:\n\n\`${results[0]}\``
          : `**${results.length} videos stabilized:**\n\n${results.map(r => `- \`${r}\``).join("\n")}`}
        />
      </Form>
    );
  }

  const isSingle = inputPaths.length <= 1;

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Stabilizing…" : "Stabilize"}
            onSubmit={() => onStabilize(!deshakeFallback)}
            style="primary"
            isLoading={isLoading}
            isDisabled={inputPaths.length === 0}
          />
        </ActionPanel>
      }
    >
      {deshakeFallback && <Paper markdown="⚠️ Using basic stabilization — vidstab unavailable. Quality will be lower." />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {isLoading ? (
        <Paper markdown={progress || "Stabilizing…"} />
      ) : (
        <>
          <Form.FilePicker
            name="inputPaths"
            label="Video Files"
            value={inputPaths}
            onChange={setInputPaths}
            accept={["video/*"]}
            multiple
          />
          <Form.NumberField
            name="strength"
            label="Stabilization Strength (1–10)"
            value={strength}
            onChange={setStrength}
            min={1}
            max={10}
          />
          {isSingle && (
            <Form.TextField
              name="outputPath"
              label="Output Path (optional)"
              value={outputPath}
              onChange={setOutputPath}
            />
          )}
        </>
      )}
    </Form>
  );
}

const StabilizeVideoWidget = defineWidget({
  name: "stabilize-video",
  description: "Stabilize shaky video files",
  schema,
  component: StabilizeVideo,
});

export default StabilizeVideoWidget;
