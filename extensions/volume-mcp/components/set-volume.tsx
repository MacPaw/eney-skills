import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, runScript, useCloseWidget } from "@eney/api";

const schema = z.object({
  level: z.number().int().optional().describe("Volume level 0-100. Omit to read the current level."),
  muted: z.boolean().optional().describe("If provided, also set the muted state."),
});

type Props = z.infer<typeof schema>;

interface VolumeState {
  level: number;
  muted: boolean;
}

async function getVolume(): Promise<VolumeState> {
  const out = (await runScript(
    `set s to (get volume settings)
     return (output volume of s as string) & "|" & (output muted of s as string)`,
  )).trim();
  const [levelStr, mutedStr] = out.split("|");
  return {
    level: Math.round(Number.parseFloat(levelStr) || 0),
    muted: mutedStr.toLowerCase() === "true",
  };
}

async function applyVolume(level: number, muted: boolean): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  const muteWord = muted ? "with output muted" : "without output muted";
  await runScript(`set volume output volume ${clamped} ${muteWord}`);
}

function SetVolume(props: Props) {
  const closeWidget = useCloseWidget();
  const [level, setLevel] = useState<number | null>(props.level ?? null);
  const [muted, setMuted] = useState<boolean>(props.muted ?? false);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const state = await getVolume();
      if (level === null) setLevel(state.level);
      setMuted((m) => (props.muted === undefined ? state.muted : m));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, []);

  async function onSubmit() {
    setIsApplying(true);
    setError("");
    try {
      await applyVolume(level ?? 0, muted);
      const updated = await getVolume();
      closeWidget(`Volume set to ${updated.level}%${updated.muted ? " (muted)" : ""}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsApplying(false);
    }
  }

  const header = <CardHeader title="System Volume" iconBundleId="com.apple.systempreferences" />;

  if (isLoading) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Apply" onAction={onSubmit} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown="Reading current volume..." />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isApplying ? "Applying..." : "Apply"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isApplying}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.NumberField name="level" label="Volume (0–100)" value={level} onChange={setLevel} min={0} max={100} />
      <Form.Checkbox name="muted" label="Muted" checked={muted} onChange={setMuted} variant="switch" />
    </Form>
  );
}

const SetVolumeWidget = defineWidget({
  name: "set-volume",
  description:
    "Show or set the macOS system output volume (0–100) and mute state. Omit the level prop to inspect the current value.",
  schema,
  component: SetVolume,
});

export default SetVolumeWidget;
