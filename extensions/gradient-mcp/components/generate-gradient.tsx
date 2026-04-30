import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  fromColor: z.string().optional().describe("Start color (HEX or CSS color name). Defaults to '#3b82f6'."),
  toColor: z.string().optional().describe("End color. Defaults to '#a855f7'."),
  angle: z.number().int().optional().describe("Angle in degrees, 0-360. Defaults to 135."),
});

type Props = z.infer<typeof schema>;

const DIRECTION_PRESETS: { label: string; value: number }[] = [
  { label: "↑ to top (0°)", value: 0 },
  { label: "↗ to top right (45°)", value: 45 },
  { label: "→ to right (90°)", value: 90 },
  { label: "↘ to bottom right (135°)", value: 135 },
  { label: "↓ to bottom (180°)", value: 180 },
  { label: "↙ to bottom left (225°)", value: 225 },
  { label: "← to left (270°)", value: 270 },
  { label: "↖ to top left (315°)", value: 315 },
];

function buildGradient(angle: number, from: string, to: string): string {
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

function buildSwatch(angle: number, from: string, to: string): string {
  const a = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(a) * 0.5;
  const dy = Math.sin(a) * 0.5;
  const x1 = (0.5 - dx).toFixed(3);
  const y1 = (0.5 + dy).toFixed(3);
  const x2 = (0.5 + dx).toFixed(3);
  const y2 = (0.5 - dy).toFixed(3);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' preserveAspectRatio='none' width='320' height='80'>` +
    `<defs><linearGradient id='g' x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}'>` +
    `<stop offset='0%' stop-color='${from}'/><stop offset='100%' stop-color='${to}'/>` +
    `</linearGradient></defs>` +
    `<rect width='1' height='1' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function GenerateGradient(props: Props) {
  const closeWidget = useCloseWidget();
  const [fromColor, setFromColor] = useState(props.fromColor ?? "#3b82f6");
  const [toColor, setToColor] = useState(props.toColor ?? "#a855f7");
  const [angle, setAngle] = useState<number | null>(props.angle ?? 135);

  const safeAngle = useMemo(() => ((angle ?? 0) % 360 + 360) % 360, [angle]);
  const css = useMemo(
    () => (fromColor && toColor ? buildGradient(safeAngle, fromColor, toColor) : ""),
    [safeAngle, fromColor, toColor],
  );
  const swatch = useMemo(
    () => (fromColor && toColor ? buildSwatch(safeAngle, fromColor, toColor) : ""),
    [safeAngle, fromColor, toColor],
  );

  function onDone() {
    if (css) closeWidget(`background: ${css};`);
    else closeWidget("No gradient generated.");
  }

  const lines: string[] = [];
  if (swatch) {
    lines.push(`![gradient](${swatch})`);
    lines.push("");
    lines.push("```css");
    lines.push(`background: ${css};`);
    lines.push("```");
  }

  return (
    <Form
      header={<CardHeader title="CSS Gradient" iconBundleId="com.apple.ColorSyncUtility" />}
      actions={
        <ActionPanel layout="row">
          {css && <Action.CopyToClipboard title="Copy CSS" content={`background: ${css};`} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="fromColor" label="From color" value={fromColor} onChange={setFromColor} />
      <Form.TextField name="toColor" label="To color" value={toColor} onChange={setToColor} />
      <Form.NumberField name="angle" label="Angle (deg)" value={angle} onChange={setAngle} min={0} max={360} />
      <Form.Dropdown
        name="preset"
        label="Direction preset"
        value={String(safeAngle)}
        onChange={(v) => setAngle(Number.parseInt(v, 10))}
      >
        {DIRECTION_PRESETS.map((p) => (
          <Form.Dropdown.Item key={p.value} title={p.label} value={String(p.value)} />
        ))}
      </Form.Dropdown>
      {lines.length > 0 && <Paper markdown={lines.join("\n")} />}
    </Form>
  );
}

const GenerateGradientWidget = defineWidget({
  name: "generate-gradient",
  description:
    "Generate a CSS linear-gradient between two colors at the chosen angle (0-360°). Lives preview is rendered as an inline SVG; pick from 8 cardinal/ordinal direction presets or set the angle directly.",
  schema,
  component: GenerateGradient,
});

export default GenerateGradientWidget;
