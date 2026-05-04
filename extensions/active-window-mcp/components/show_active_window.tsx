import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { readActiveWindow, listAppWindows, activateApp, type ActiveWindow } from "../helpers/active.js";

const schema = z.object({
  activate: z
    .string()
    .optional()
    .describe("Optional app name to activate before introspection (e.g. 'Safari')."),
});

type Props = z.infer<typeof schema>;

interface State {
  status: "loading" | "done" | "error";
  errorMsg: string;
  active: ActiveWindow | null;
  appWindows: { index: number; title: string }[];
  flash: string;
}

function buildMarkdown(s: State): string {
  if (s.status === "loading") return "_Reading frontmost window…_";
  if (s.status === "error") return `**Error:** ${s.errorMsg}`;
  if (!s.active) return "_No frontmost app detected._";
  const a = s.active;
  const lines: string[] = [];
  lines.push(`### ${a.appName}`);
  if (a.windowTitle) lines.push(`_${a.windowTitle}_`);
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Bundle ID | \`${a.bundleId}\` |`);
  lines.push(`| PID | \`${a.pid}\` |`);
  lines.push(`| Window count | ${a.windowCount} |`);
  if (a.position) lines.push(`| Position | ${Math.round(a.position.x)}, ${Math.round(a.position.y)} |`);
  if (a.size) lines.push(`| Size | ${Math.round(a.size.width)} × ${Math.round(a.size.height)} |`);
  if (s.appWindows.length > 0) {
    lines.push("");
    lines.push(`**All windows of ${a.appName} (${s.appWindows.length}):**`);
    lines.push("");
    s.appWindows.forEach((w) => {
      lines.push(`- W${w.index}: ${w.title || "_(untitled)_"}`);
    });
  }
  if (s.flash) {
    lines.push("");
    lines.push(`> ${s.flash}`);
  }
  return lines.join("\n");
}

function ActiveWindowWidget(props: Props) {
  const closeWidget = useCloseWidget();
  const [appName, setAppName] = useState(props.activate ?? "");
  const [state, setState] = useState<State>({ status: "loading", errorMsg: "", active: null, appWindows: [], flash: "" });
  const [reloadCount, setReloadCount] = useState(0);
  const [didActivate, setDidActivate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading", flash: "" }));
    (async () => {
      try {
        if (!didActivate && props.activate) {
          try {
            await activateApp(props.activate);
            // Give it a moment to come to front
            await new Promise((r) => setTimeout(r, 250));
          } catch {
            /* non-fatal */
          }
          setDidActivate(true);
        }
        const a = await readActiveWindow();
        let wins: { index: number; title: string }[] = [];
        if (a.windowCount > 0) {
          try {
            wins = await listAppWindows(a.appName);
          } catch {
            /* ignore */
          }
        }
        if (cancelled) return;
        setState((s) => ({ status: "done", errorMsg: "", active: a, appWindows: wins, flash: s.flash }));
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
          active: null,
          appWindows: [],
          flash: "",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [reloadCount]);

  function refresh() {
    setReloadCount((c) => c + 1);
  }

  async function onActivate() {
    if (!appName.trim()) {
      setState((s) => ({ ...s, flash: "⚠️ Enter an app name first." }));
      return;
    }
    try {
      await activateApp(appName);
      setState((s) => ({ ...s, flash: `✅ Activated ${appName}` }));
      setReloadCount((c) => c + 1);
    } catch (err) {
      setState((s) => ({ ...s, flash: `❌ ${err instanceof Error ? err.message : String(err)}` }));
    }
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    if (!state.active) {
      closeWidget("No frontmost app.");
      return;
    }
    const a = state.active;
    closeWidget(
      `Frontmost: ${a.appName} (${a.bundleId}, pid ${a.pid}). ` +
      `${a.windowTitle ? `Window: "${a.windowTitle}". ` : ""}` +
      (a.size ? `Size: ${Math.round(a.size.width)}×${Math.round(a.size.height)}. ` : "") +
      (a.position ? `Position: ${Math.round(a.position.x)},${Math.round(a.position.y)}. ` : "") +
      `${a.windowCount} window${a.windowCount === 1 ? "" : "s"}.`,
    );
  }

  return (
    <Form
      header={<CardHeader title="Active Window" iconBundleId="com.apple.systempreferences" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={refresh} style="primary" />
          <Action title="Activate app" onAction={onActivate} style="secondary" />
          <Action title="Safari" onAction={() => { setAppName("Safari"); }} style="secondary" />
          <Action title="Finder" onAction={() => { setAppName("Finder"); }} style="secondary" />
          <Action title="Terminal" onAction={() => { setAppName("Terminal"); }} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(state)} />
      <Form.TextField name="appName" label="App to activate (optional)" value={appName} onChange={setAppName} />
    </Form>
  );
}

const ActiveWindowWidgetDef = defineWidget({
  name: "show_active_window",
  description:
    "Show the frontmost app's metadata: app name, bundle ID, PID, window title, window count, and window size + position. Optional 'app to activate' field brings any installed app to the front before reading. Uses AppleScript / System Events; requires Accessibility permission.",
  schema,
  component: ActiveWindowWidget,
});

export default ActiveWindowWidgetDef;
