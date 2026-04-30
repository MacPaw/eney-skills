import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  input: z.string().optional().describe("Color value: a hex (#3366ff or #36f), rgb(...), or hsl(...) string."),
});

type Props = z.infer<typeof schema>;

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

function parseHex(input: string): RGB | null {
  const trimmed = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) return null;
  let hex = trimmed;
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function parseRgb(input: string): RGB | null {
  const match = input.match(/rgba?\(\s*([^)]+)\s*\)/i);
  if (!match) return null;
  const parts = match[1].split(/\s*,\s*|\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const nums = parts.slice(0, 3).map((p) => Number.parseFloat(p));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return { r: clamp(nums[0], 0, 255), g: clamp(nums[1], 0, 255), b: clamp(nums[2], 0, 255) };
}

function parseHsl(input: string): RGB | null {
  const match = input.match(/hsla?\(\s*([^)]+)\s*\)/i);
  if (!match) return null;
  const parts = match[1].split(/\s*,\s*|\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const h = Number.parseFloat(parts[0]);
  const s = Number.parseFloat(parts[1].replace("%", ""));
  const l = Number.parseFloat(parts[2].replace("%", ""));
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  return hslToRgb({ h: ((h % 360) + 360) % 360, s: clamp(s, 0, 100), l: clamp(l, 0, 100) });
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

function parseInput(input: string): RGB | null {
  return parseHsl(input) ?? parseRgb(input) ?? parseHex(input);
}

function swatch(rgb: RGB): string {
  const hex = rgbToHex(rgb);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='40'><rect width='160' height='40' fill='${hex}'/></svg>`;
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return `![swatch](${dataUrl})`;
}

function ConvertColor(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");

  const rgb = useMemo(() => parseInput(input), [input]);
  const hex = rgb ? rgbToHex(rgb) : "";
  const rgbStr = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "";
  const hsl = rgb ? rgbToHsl(rgb) : null;
  const hslStr = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : "";

  function onDone() {
    if (rgb) closeWidget(`${hex} • ${rgbStr} • ${hslStr}`);
    else closeWidget("No color parsed.");
  }

  const lines: string[] = [];
  if (rgb) {
    lines.push(swatch(rgb));
    lines.push("");
    lines.push(`| | |`);
    lines.push(`|---|---|`);
    lines.push(`| **HEX** | \`${hex}\` |`);
    lines.push(`| **RGB** | \`${rgbStr}\` |`);
    lines.push(`| **HSL** | \`${hslStr}\` |`);
  } else if (input.trim()) {
    lines.push("_Could not parse input as a color._");
    lines.push("");
    lines.push("Examples: `#3366ff`, `#36f`, `rgb(51, 102, 255)`, `hsl(225, 100%, 60%)`");
  } else {
    lines.push("Enter a color value above.");
  }

  return (
    <Form
      header={<CardHeader title="Color Converter" iconBundleId="com.apple.ColorSyncUtility" />}
      actions={
        <ActionPanel layout="row">
          {hex && <Action.CopyToClipboard title="Copy HEX" content={hex} />}
          {rgbStr && <Action.CopyToClipboard title="Copy RGB" content={rgbStr} />}
          {hslStr && <Action.CopyToClipboard title="Copy HSL" content={hslStr} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="input" label="Color" value={input} onChange={setInput} />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ConvertColorWidget = defineWidget({
  name: "convert-color",
  description: "Convert a color between HEX, RGB, and HSL formats. Accepts any of the three as input.",
  schema,
  component: ConvertColor,
});

export default ConvertColorWidget;
