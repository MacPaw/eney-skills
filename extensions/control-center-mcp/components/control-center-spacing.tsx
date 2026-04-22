import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, CardHeader, defineWidget, useCloseWidget } from "@eney/api";
import { spawn } from "node:child_process";

const schema = z.object({});
type Props = z.infer<typeof schema>;

const BUNDLE_ID = "com.apple.controlcenter";

type PresetKey = "ultra-compact" | "tight" | "comfortable" | "default";

interface Preset {
  title: string;
  spacing: number | null;
  padding: number | null;
  tagline: string;
  detail: string;
}

const PRESETS: Record<PresetKey, Preset> = {
  "ultra-compact": {
    title: "Ultra Compact",
    spacing: 0,
    padding: 0,
    tagline: "No gaps — every pixel counts.",
    detail: "Spacing: `0`  ·  Padding: `0`",
  },
  "tight": {
    title: "Tight",
    spacing: 6,
    padding: 4,
    tagline: "Fits more icons without feeling cramped.",
    detail: "Spacing: `6`  ·  Padding: `4`",
  },
  "comfortable": {
    title: "Comfortable",
    spacing: 12,
    padding: 8,
    tagline: "Slightly tighter than default — good balance.",
    detail: "Spacing: `12`  ·  Padding: `8`",
  },
  "default": {
    title: "macOS Default",
    spacing: null,
    padding: null,
    tagline: "Standard Apple spacing, as shipped.",
    detail: "Spacing: `~14`  ·  Padding: system default",
  },
};

function readShell(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn("sh", ["-c", cmd]);
    let stdout = "";
    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.on("error", () => resolve(""));
    proc.on("close", () => resolve(stdout.trim()));
  });
}

function runShell(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("sh", ["-c", cmd]);
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code: number) => {
      if (code !== 0) { reject(new Error(stderr.trim() || `exit ${code}`)); return; }
      resolve();
    });
  });
}

async function detectCurrentPreset(): Promise<PresetKey> {
  const spacing = await readShell("defaults -currentHost read -globalDomain NSStatusItemSpacing 2>/dev/null || echo ''");
  const padding = await readShell("defaults -currentHost read -globalDomain NSStatusItemSelectionPadding 2>/dev/null || echo ''");

  const s = spacing.trim();
  const p = padding.trim();

  if (s === "0" && p === "0") return "ultra-compact";
  if (s === "6" && p === "4") return "tight";
  if (s === "12" && p === "8") return "comfortable";
  return "default";
}

async function applyPreset(key: PresetKey): Promise<void> {
  const preset = PRESETS[key];
  if (preset.spacing === null) {
    await runShell(
      "defaults -currentHost delete -globalDomain NSStatusItemSpacing 2>/dev/null; " +
      "defaults -currentHost delete -globalDomain NSStatusItemSelectionPadding 2>/dev/null; " +
      "killall ControlCenter"
    );
  } else {
    await runShell(
      `defaults -currentHost write -globalDomain NSStatusItemSpacing -int ${preset.spacing} && ` +
      `defaults -currentHost write -globalDomain NSStatusItemSelectionPadding -int ${preset.padding} && ` +
      `killall ControlCenter`
    );
  }
}

type WidgetState = "loading" | "idle" | "applying" | "done" | "error";

function ControlCenterSpacing(_props: Props) {
  const closeWidget = useCloseWidget();
  const [widgetState, setWidgetState] = useState<WidgetState>("loading");
  const [currentPreset, setCurrentPreset] = useState<PresetKey>("default");
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("default");
  const [error, setError] = useState("");

  useEffect(() => {
    detectCurrentPreset()
      .then((preset) => {
        setCurrentPreset(preset);
        setSelectedPreset(preset);
        setWidgetState("idle");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setWidgetState("error");
      });
  }, []);

  async function onApply() {
    setWidgetState("applying");
    setError("");
    try {
      await applyPreset(selectedPreset);
      setCurrentPreset(selectedPreset);
      setWidgetState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setWidgetState("error");
    }
  }

  function onDone() {
    closeWidget(`Menu bar spacing set to: ${PRESETS[currentPreset].title}`);
  }

  const isAlreadyApplied = selectedPreset === currentPreset;

  if (widgetState === "error") {
    return (
      <Form
        header={<CardHeader title="Menu Bar Spacing" iconBundleId={BUNDLE_ID} />}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={() => closeWidget(`Error: ${error}`)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`**Error:** ${error}`} />
      </Form>
    );
  }

  if (widgetState === "done") {
    return (
      <Form
        header={<CardHeader title="Menu Bar Spacing" iconBundleId={BUNDLE_ID} />}
        actions={
          <ActionPanel layout="row">
            <Action title="Change Again" onAction={() => setWidgetState("idle")} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`## ${PRESETS[currentPreset].title} applied ✓\n\n${PRESETS[currentPreset].tagline}\n\n${PRESETS[currentPreset].detail}`} />
      </Form>
    );
  }

  const currentInfo = PRESETS[currentPreset];
  const statusMarkdown = `**Active:** ${currentInfo.title} · ${currentInfo.detail}`;

  const applyTitle = widgetState === "applying"
    ? "Applying…"
    : isAlreadyApplied ? "Already Active" : `Apply`;

  return (
    <Form
      header={<CardHeader title="Menu Bar Spacing" iconBundleId={BUNDLE_ID} />}
      actions={
        <ActionPanel layout="row">
          <Action title="Cancel" onAction={() => closeWidget("Cancelled.")} style="secondary" />
          <Action
            title={applyTitle}
            onAction={onApply}
            style="primary"
            isLoading={widgetState === "applying"}
            isDisabled={widgetState === "applying" || isAlreadyApplied}
          />
        </ActionPanel>
      }
    >
      <Paper markdown={statusMarkdown} />
      <Form.Dropdown
        name="preset"
        label="Choose Preset"
        value={selectedPreset}
        onChange={(v) => setSelectedPreset(v as PresetKey)}
      >
        <Form.Dropdown.Item value="ultra-compact" title="Ultra Compact — spacing 0, padding 0" />
        <Form.Dropdown.Item value="tight" title="Tight — spacing 6, padding 4" />
        <Form.Dropdown.Item value="comfortable" title="Comfortable — spacing 12, padding 8" />
        <Form.Dropdown.Item value="default" title="macOS Default — system values" />
      </Form.Dropdown>
    </Form>
  );
}

const ControlCenterSpacingWidget = defineWidget({
  name: "control-center-spacing",
  description: "Adjust menu bar icon spacing on macOS — choose from presets (ultra compact, tight, comfortable, default) to control how tightly icons are packed in the menu bar",
  schema,
  component: ControlCenterSpacing,
});

export default ControlCenterSpacingWidget;
