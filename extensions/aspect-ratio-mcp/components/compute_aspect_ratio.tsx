import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { reduce, fromOneDimension, type Reduced } from "../helpers/aspect.js";

const schema = z.object({
  width: z.number().describe("Width in pixels (or any unit)."),
  height: z.number().describe("Height in pixels."),
});

type Props = z.infer<typeof schema>;

interface State {
  result: Reduced | null;
  error: string;
}

function safe(width: number, height: number): State {
  try {
    return { result: reduce(width, height), error: "" };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function ComputeAspect(props: Props) {
  const closeWidget = useCloseWidget();
  const [width, setWidth] = useState<number>(props.width);
  const [height, setHeight] = useState<number>(props.height);
  const [state, setState] = useState<State>(() => safe(props.width, props.height));
  const [otherDim, setOtherDim] = useState<{ width: number; height: number } | null>(null);

  function recompute(opts?: Partial<{ w: number; h: number }>) {
    const w = opts?.w ?? width;
    const h = opts?.h ?? height;
    setState(safe(w, h));
    setOtherDim(null);
  }

  function onCompute() {
    recompute();
  }

  function onPreset(w: number, h: number) {
    setWidth(w);
    setHeight(h);
    recompute({ w, h });
  }

  function onScaleToWidth(target: number) {
    if (state.result) {
      const dims = fromOneDimension(state.result.num, state.result.den, target, undefined);
      setOtherDim(dims);
    }
  }

  function onScaleToHeight(target: number) {
    if (state.result) {
      const dims = fromOneDimension(state.result.num, state.result.den, undefined, target);
      setOtherDim(dims);
    }
  }

  function onDone() {
    if (state.error) {
      closeWidget(`Error: ${state.error}`);
      return;
    }
    if (!state.result) {
      closeWidget("Closed.");
      return;
    }
    const r = state.result;
    closeWidget(
      `Aspect ratio of ${width}×${height}: **${r.num}:${r.den}** (${r.decimal.toFixed(4)})${r.named ? `, ≈ ${r.named}` : ""}.`,
    );
  }

  let markdown: string;
  if (state.error) {
    markdown = `**Error:** ${state.error}`;
  } else if (state.result) {
    const r = state.result;
    const lines = [
      `### **${r.num}:${r.den}**`,
      "",
      `| | |`,
      `|---|---|`,
      `| Decimal | ${r.decimal.toFixed(4)} |`,
      `| Width × Height | ${width} × ${height} |`,
      ...(r.named ? [`| Named | ${r.named} |`] : []),
    ];
    if (otherDim) {
      lines.push(
        `| Scaled | **${Math.round(otherDim.width)} × ${Math.round(otherDim.height)}** (preserves ${r.num}:${r.den}) |`,
      );
    }
    markdown = lines.join("\n");
  } else {
    markdown = "_Enter dimensions and tap Compute._";
  }

  return (
    <Form
      header={<CardHeader title="Aspect Ratio" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Compute" onSubmit={onCompute} style="primary" />
          <Action title="HD 1920×1080" onAction={() => onPreset(1920, 1080)} style="secondary" />
          <Action title="4K 3840×2160" onAction={() => onPreset(3840, 2160)} style="secondary" />
          <Action title="Square 1080" onAction={() => onPreset(1080, 1080)} style="secondary" />
          <Action title="Scale to 1920w" onAction={() => onScaleToWidth(1920)} style="secondary" />
          <Action title="Scale to 1080h" onAction={() => onScaleToHeight(1080)} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.NumberField
        name="width"
        label="Width"
        value={width}
        onChange={(v) => setWidth(Number(v) || 0)}
      />
      <Form.NumberField
        name="height"
        label="Height"
        value={height}
        onChange={(v) => setHeight(Number(v) || 0)}
      />
    </Form>
  );
}

const AspectRatioWidget = defineWidget({
  name: "compute_aspect_ratio",
  description:
    "Compute and simplify aspect ratios. Reduces W:H to lowest terms via GCD, identifies common named ratios (16:9, 4:3, 21:9, 1.85:1, etc.), and can scale to a target width or height while preserving the ratio. Pure local math.",
  schema,
  component: ComputeAspect,
});

export default AspectRatioWidget;
