import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  listRunning,
  startBackground,
  stopAll,
  fmtDuration,
  type CaffeinateMode,
} from "../helpers/caffeinate.js";

const MODES: CaffeinateMode[] = ["display", "system", "system+display"];

const schema = z.object({
  durationMinutes: z
    .number()
    .int()
    .optional()
    .describe("How long to keep awake, in minutes. 0 = indefinite. Defaults to 60."),
  mode: z
    .enum(["display", "system", "system+display"])
    .optional()
    .describe("'display' (no display sleep), 'system' (no idle/disk sleep), or 'system+display'. Defaults to 'system+display'."),
});

type Props = z.infer<typeof schema>;

interface State {
  running: number[];
  flash: string;
  status: "loading" | "done" | "error";
  errorMsg: string;
}

const PRESETS: { label: string; minutes: number }[] = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
  { label: "4 h", minutes: 240 },
];

function CaffeinateWidget(props: Props) {
  const closeWidget = useCloseWidget();
  const [duration, setDuration] = useState<number>(props.durationMinutes ?? 60);
  const [mode, setMode] = useState<CaffeinateMode>(props.mode ?? "system+display");
  const [state, setState] = useState<State>({ running: [], flash: "", status: "loading", errorMsg: "" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    listRunning()
      .then((pids) => {
        if (cancelled) return;
        setState((s) => ({ ...s, running: pids, status: "done", errorMsg: "" }));
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          running: [],
          flash: "",
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
        });
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function refresh() {
    setReloadCount((c) => c + 1);
  }

  function onStart() {
    try {
      const sec = Math.max(0, Math.floor(duration * 60));
      const r = startBackground(sec, mode);
      setState((s) => ({ ...s, flash: `✅ Started caffeinate (pid ${r.pid}, ${fmtDuration(sec)}, ${mode})` }));
      refresh();
    } catch (err) {
      setState((s) => ({ ...s, flash: `❌ ${err instanceof Error ? err.message : String(err)}` }));
    }
  }

  function onStartIndefinite() {
    try {
      const r = startBackground(0, mode);
      setState((s) => ({ ...s, flash: `✅ Started caffeinate (pid ${r.pid}, indefinite, ${mode})` }));
      refresh();
    } catch (err) {
      setState((s) => ({ ...s, flash: `❌ ${err instanceof Error ? err.message : String(err)}` }));
    }
  }

  async function onStop() {
    try {
      const remaining = await stopAll();
      setState((s) => ({ ...s, flash: remaining === 0 ? "✅ All caffeinate processes stopped" : `⚠️ ${remaining} still running` }));
      refresh();
    } catch (err) {
      setState((s) => ({ ...s, flash: `❌ ${err instanceof Error ? err.message : String(err)}` }));
    }
  }

  function onPreset(min: number) {
    setDuration(min);
    try {
      const sec = min * 60;
      const r = startBackground(sec, mode);
      setState((s) => ({ ...s, flash: `✅ Caffeinated for ${fmtDuration(sec)} (pid ${r.pid})` }));
      refresh();
    } catch (err) {
      setState((s) => ({ ...s, flash: `❌ ${err instanceof Error ? err.message : String(err)}` }));
    }
  }

  function onSetMode(m: CaffeinateMode) {
    setMode(m);
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    closeWidget(
      state.running.length > 0
        ? `Caffeinate is active (${state.running.length} process${state.running.length === 1 ? "" : "es"}, mode ${mode}).`
        : "Caffeinate is not running.",
    );
  }

  let markdown: string;
  if (state.status === "loading") {
    markdown = "_Checking caffeinate state…_";
  } else if (state.status === "error") {
    markdown = `**Error:** ${state.errorMsg}`;
  } else {
    const lines: string[] = [];
    if (state.running.length > 0) {
      lines.push(`### ☕️ Caffeinate is **active**`);
      lines.push("");
      lines.push(`Running PIDs: ${state.running.map((p) => `\`${p}\``).join(", ")}`);
    } else {
      lines.push(`### 💤 Caffeinate is **idle**`);
      lines.push("");
      lines.push(`Mac may sleep normally according to Energy Saver settings.`);
    }
    lines.push("");
    lines.push(`Mode: \`${mode}\` · Duration: \`${fmtDuration(Math.max(0, duration * 60))}\``);
    if (state.flash) {
      lines.push("");
      lines.push(`> ${state.flash}`);
    }
    markdown = lines.join("\n");
  }

  return (
    <Form
      header={<CardHeader title="Caffeinate" iconBundleId="com.apple.systempreferences" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Start" onSubmit={onStart} style="primary" />
          <Action title="Indefinite" onAction={onStartIndefinite} style="secondary" />
          <Action title="Stop all" onAction={onStop} style="secondary" />
          {PRESETS.map((p) => (
            <Action key={p.label} title={p.label} onAction={() => onPreset(p.minutes)} style="secondary" />
          ))}
          <Action title="display" onAction={() => onSetMode("display")} style="secondary" />
          <Action title="system" onAction={() => onSetMode("system")} style="secondary" />
          <Action title="system+display" onAction={() => onSetMode("system+display")} style="secondary" />
          <Action title="Refresh" onAction={refresh} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.NumberField
        name="durationMinutes"
        label="Duration (minutes, 0 = indefinite)"
        value={duration}
        onChange={(v) => setDuration(Math.max(0, Math.floor(Number(v) || 0)))}
      />
    </Form>
  );
}

const CaffeinateWidgetDef = defineWidget({
  name: "caffeinate",
  description:
    "Keep your Mac awake by spawning a detached `caffeinate` background process. Three sleep-prevention modes (display / system / system+display), preset durations (15m / 30m / 1h / 2h / 4h), indefinite mode, and a 'Stop all' button that pkill's any running caffeinate processes.",
  schema,
  component: CaffeinateWidget,
});

export default CaffeinateWidgetDef;
