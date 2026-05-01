import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { tile, readFrontWindow, REGIONS, REGION_LABEL, type FrontWindow, type Region, type Frame } from "../helpers/tile.js";

const schema = z.object({
  region: z
    .enum([
      "left-half",
      "right-half",
      "top-half",
      "bottom-half",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "full",
      "center",
      "left-third",
      "middle-third",
      "right-third",
    ])
    .optional()
    .describe("Region to tile to. If provided, applied immediately on open."),
});

type Props = z.infer<typeof schema>;

interface State {
  status: "loading" | "done" | "error";
  errorMsg: string;
  window: FrontWindow | null;
  applied: Frame | null;
  flash: string;
}

const QUICK: Region[] = ["left-half", "right-half", "full", "center", "top-left", "top-right", "bottom-left", "bottom-right"];
const THIRDS: Region[] = ["left-third", "middle-third", "right-third"];

function buildMarkdown(state: State): string {
  if (state.status === "loading") return "_Reading frontmost window…_";
  if (state.status === "error") return `**Error:** ${state.errorMsg}\n\n_Window tiling needs Accessibility permission. Grant it in System Settings → Privacy & Security → Accessibility for the controlling app._`;
  const w = state.window;
  if (!w) return "_No frontmost window detected._";
  const lines: string[] = [];
  lines.push(`### ${w.app}`);
  if (w.title) lines.push(`_${w.title}_`);
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Window position | ${Math.round(w.position.x)}, ${Math.round(w.position.y)} |`);
  lines.push(`| Window size | ${Math.round(w.size.width)} × ${Math.round(w.size.height)} |`);
  lines.push(`| Screen frame | ${Math.round(w.screen.width)} × ${Math.round(w.screen.height)} @ ${Math.round(w.screen.x)},${Math.round(w.screen.y)} |`);
  if (state.applied) {
    lines.push(
      `| Applied frame | ${Math.round(state.applied.width)} × ${Math.round(state.applied.height)} @ ${Math.round(state.applied.x)},${Math.round(state.applied.y)} |`,
    );
  }
  if (state.flash) {
    lines.push("");
    lines.push(`> ${state.flash}`);
  }
  return lines.join("\n");
}

function TileWindow(props: Props) {
  const closeWidget = useCloseWidget();
  const [state, setState] = useState<State>({ status: "loading", errorMsg: "", window: null, applied: null, flash: "" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading", flash: "" }));
    (async () => {
      try {
        if (props.region) {
          const result = await tile(props.region);
          if (cancelled) return;
          setState({
            status: "done",
            errorMsg: "",
            window: result.window,
            applied: result.applied,
            flash: `✅ Tiled to ${REGION_LABEL[props.region]}`,
          });
        } else {
          const w = await readFrontWindow();
          if (cancelled) return;
          setState({ status: "done", errorMsg: "", window: w, applied: null, flash: "" });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
          window: null,
          applied: null,
          flash: "",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [reloadCount]);

  function refresh() {
    setReloadCount((c) => c + 1);
  }

  async function onTile(region: Region) {
    try {
      const result = await tile(region);
      setState({
        status: "done",
        errorMsg: "",
        window: result.window,
        applied: result.applied,
        flash: `✅ Tiled to ${REGION_LABEL[region]}`,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        flash: `❌ ${err instanceof Error ? err.message : String(err)}`,
      }));
    }
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    if (!state.window) {
      closeWidget("No frontmost window.");
      return;
    }
    closeWidget(
      `Frontmost window: ${state.window.app}${state.window.title ? ` — ${state.window.title}` : ""}.` +
      (state.applied
        ? ` Tiled to ${Math.round(state.applied.width)}×${Math.round(state.applied.height)} @ ${Math.round(state.applied.x)},${Math.round(state.applied.y)}.`
        : ""),
    );
  }

  return (
    <Form
      header={<CardHeader title="Tile Window" iconBundleId="com.apple.systempreferences" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={refresh} style="primary" />
          {QUICK.map((r) => (
            <Action key={r} title={REGION_LABEL[r]} onAction={() => onTile(r)} style="secondary" />
          ))}
          {THIRDS.map((r) => (
            <Action key={r} title={REGION_LABEL[r]} onAction={() => onTile(r)} style="secondary" />
          ))}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(state)} />
    </Form>
  );
}

const TileWindowWidget = defineWidget({
  name: "tile_window",
  description:
    "Tile the frontmost window to a named region of its screen — halves, quarters, thirds, full, or centered. Computes the target rectangle from the screen's visible frame and applies it via AppleScript + System Events. Requires Accessibility permission.",
  schema,
  component: TileWindow,
});

export default TileWindowWidget;
