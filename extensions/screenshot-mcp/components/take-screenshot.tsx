import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Files, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const schema = z.object({
  mode: z.enum(["screen", "selection", "window"]).optional().describe("Capture mode. Defaults to 'selection'."),
  format: z.enum(["png", "jpg"]).optional().describe("Output format. Defaults to 'png'."),
  delay: z.number().int().optional().describe("Delay in seconds before capture. Defaults to 0."),
});

type Props = z.infer<typeof schema>;

type Mode = "screen" | "selection" | "window";
type Format = "png" | "jpg";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} at ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

async function runScreencapture(args: string[]): Promise<{ ok: boolean; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn("screencapture", args);
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ ok: code === 0, stderr: stderr.trim() }));
  });
}

function TakeScreenshot(props: Props) {
  const closeWidget = useCloseWidget();
  const [mode, setMode] = useState<Mode>(props.mode ?? "selection");
  const [format, setFormat] = useState<Format>(props.format ?? "png");
  const [delay, setDelay] = useState<number | null>(props.delay ?? 0);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setIsCapturing(true);
    setError("");
    const filename = `Screenshot ${timestamp()}.${format}`;
    const path = join(homedir(), "Desktop", filename);
    const args: string[] = ["-t", format];
    if (delay && delay > 0) args.push("-T", String(delay));
    if (mode === "selection") args.push("-i");
    if (mode === "window") args.push("-iW");
    args.push(path);

    try {
      const { ok, stderr } = await runScreencapture(args);
      if (!ok) {
        setError(stderr || "Screenshot was cancelled.");
        setIsCapturing(false);
        return;
      }
      const { promises: fs } = await import("node:fs");
      try {
        await fs.access(path);
      } catch {
        setError("Screenshot was cancelled.");
        setIsCapturing(false);
        return;
      }
      setSavedPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCapturing(false);
    }
  }

  function onDone() {
    if (savedPath) {
      closeWidget(`Saved screenshot to ${savedPath}.`);
    } else {
      closeWidget("Screenshot cancelled.");
    }
  }

  const header = <CardHeader title="Take Screenshot" iconBundleId="com.apple.screencaptureui" />;

  if (savedPath) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.ShowInFinder title="Show in Finder" path={savedPath} />
            <Action.SubmitForm title="Take Another" onSubmit={() => setSavedPath(null)} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`Saved to \`${savedPath}\``} />
        <Files>
          <Files.Item path={savedPath} />
        </Files>
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isCapturing ? "Capturing..." : "Take Screenshot"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isCapturing}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="mode" label="Mode" value={mode} onChange={(v) => setMode(v as Mode)}>
        <Form.Dropdown.Item title="Interactive selection" value="selection" />
        <Form.Dropdown.Item title="Window" value="window" />
        <Form.Dropdown.Item title="Full screen" value="screen" />
      </Form.Dropdown>
      <Form.Dropdown name="format" label="Format" value={format} onChange={(v) => setFormat(v as Format)}>
        <Form.Dropdown.Item title="PNG" value="png" />
        <Form.Dropdown.Item title="JPEG" value="jpg" />
      </Form.Dropdown>
      <Form.NumberField name="delay" label="Delay (seconds)" value={delay} onChange={setDelay} min={0} max={60} />
    </Form>
  );
}

const TakeScreenshotWidget = defineWidget({
  name: "take-screenshot",
  description: "Take a screenshot of the full screen, an interactive selection, or a window, and save it to ~/Desktop.",
  schema,
  component: TakeScreenshot,
});

export default TakeScreenshotWidget;
