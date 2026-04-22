import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Files, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { spawn } from "child_process";
import path from "path";

const schema = z.object({
  inputPath: z.string().optional().describe("Path to the input video file to stabilize."),
  strength: z.number().optional().describe("Stabilization strength from 1 (subtle) to 10 (aggressive). Default is 5."),
});

type Props = z.infer<typeof schema>;
type FfmpegStatus = "checking" | "missing" | "installing" | "ready";

const EXTENDED_PATH = `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`;
const SPAWN_ENV = { ...process.env, PATH: EXTENDED_PATH };

function spawnAsync(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env: SPAWN_ENV });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { output += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}.\n${output.slice(-800)}`));
    });
    proc.on("error", (e) => reject(new Error(`Failed to run ${cmd}: ${e.message}`)));
  });
}

function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("which", ["ffmpeg"], { env: SPAWN_ENV });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

function strengthToShift(strength: number): number {
  // deshake rx/ry must be multiples of 16 (16, 32, 48, 64)
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
  const [installError, setInstallError] = useState("");
  const [inputPaths, setInputPaths] = useState<string[]>(props.inputPath ? [props.inputPath] : []);
  const [outputPath, setOutputPath] = useState("");
  const [strength, setStrength] = useState<number | null>(props.strength ?? 5);
  const [results, setResults] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkFfmpeg().then((exists) => setFfmpegStatus(exists ? "ready" : "missing"));
  }, []);

  async function onInstall() {
    setFfmpegStatus("installing");
    setInstallError("");
    try {
      await spawnAsync("brew", ["install", "ffmpeg"]);
      setFfmpegStatus("ready");
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e));
      setFfmpegStatus("missing");
    }
  }

  function onCancelInstall() {
    closeWidget("ffmpeg is required to stabilize videos. Skill cancelled.");
  }

  async function onStabilize() {
    if (inputPaths.length === 0) return;
    setIsLoading(true);
    setError("");
    setProgress("");

    const shift = strengthToShift(strength ?? 5);
    const outputs: string[] = [];

    try {
      for (let i = 0; i < inputPaths.length; i++) {
        const input = inputPaths[i];
        const isSingle = inputPaths.length === 1;
        const output = isSingle && outputPath.trim() ? outputPath.trim() : outputFor(input);
        setProgress(inputPaths.length > 1 ? `Processing ${i + 1} of ${inputPaths.length}: ${path.basename(input)}` : "");
        await spawnAsync("ffmpeg", ["-i", input, "-vf", `deshake=rx=${shift}:ry=${shift}`, "-y", output]);
        outputs.push(output);
      }
      setResults(outputs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
      setProgress("");
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
      <Form actions={<ActionPanel><Action title="Cancel" onAction={onCancelInstall} style="secondary" /></ActionPanel>}>
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
            <Action title="Cancel" onAction={onCancelInstall} style="secondary" />
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
        {installError && <Paper markdown={`**Installation failed:**\n\n${installError}`} />}
        <Paper markdown="**ffmpeg is required** to stabilize videos.\n\nffmpeg was not found on your system. Install it via Homebrew to continue — this may take a few minutes." />
      </Form>
    );
  }

  if (results.length > 0) {
    return (
      <Form
        actions={
          <ActionPanel layout="row">
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
            title={isLoading ? (progress || "Stabilizing…") : "Stabilize"}
            onSubmit={onStabilize}
            style="primary"
            isLoading={isLoading}
            isDisabled={inputPaths.length === 0}
          />
        </ActionPanel>
      }
    >
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
