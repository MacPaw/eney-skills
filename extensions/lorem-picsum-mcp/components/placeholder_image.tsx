import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  width: z
    .number()
    .int()
    .optional()
    .describe("Image width in pixels. Defaults to 600. Max 5000."),
  height: z
    .number()
    .int()
    .optional()
    .describe("Image height in pixels. Defaults to 400. Max 5000."),
  grayscale: z.boolean().optional().describe("Render in grayscale. Default false."),
  blur: z
    .number()
    .int()
    .optional()
    .describe("Blur amount, 1–10. Defaults to 0 (no blur)."),
  seed: z.string().optional().describe("Stable seed string. Same seed always returns the same image."),
});

type Props = z.infer<typeof schema>;

interface PicsumOptions {
  width: number;
  height: number;
  grayscale: boolean;
  blur: number;
  seed: string;
}

function buildUrl(o: PicsumOptions): string {
  const base = o.seed.trim()
    ? `https://picsum.photos/seed/${encodeURIComponent(o.seed.trim())}/${o.width}/${o.height}`
    : `https://picsum.photos/${o.width}/${o.height}`;
  const params: string[] = [];
  if (o.grayscale) params.push("grayscale");
  if (o.blur >= 1 && o.blur <= 10) params.push(`blur=${o.blur}`);
  if (!o.seed.trim()) params.push(`random=${Math.random().toString(36).slice(2, 8)}`);
  return params.length ? `${base}?${params.join("&")}` : base;
}

function clamp(n: number, min: number, max: number, dflt: number): number {
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function PlaceholderImage(props: Props) {
  const closeWidget = useCloseWidget();
  const [width, setWidth] = useState<number>(clamp(props.width ?? 600, 1, 5000, 600));
  const [height, setHeight] = useState<number>(clamp(props.height ?? 400, 1, 5000, 400));
  const [grayscale, setGrayscale] = useState<boolean>(props.grayscale ?? false);
  const [blur, setBlur] = useState<number>(clamp(props.blur ?? 0, 0, 10, 0));
  const [seed, setSeed] = useState<string>(props.seed ?? "");

  const [url, setUrl] = useState<string>(() =>
    buildUrl({
      width: clamp(props.width ?? 600, 1, 5000, 600),
      height: clamp(props.height ?? 400, 1, 5000, 400),
      grayscale: props.grayscale ?? false,
      blur: clamp(props.blur ?? 0, 0, 10, 0),
      seed: props.seed ?? "",
    }),
  );

  function regenerate(opts?: Partial<PicsumOptions>) {
    setUrl(
      buildUrl({
        width,
        height,
        grayscale,
        blur,
        seed,
        ...opts,
      }),
    );
  }

  function onGenerate() {
    regenerate();
  }

  function onToggleGray() {
    const v = !grayscale;
    setGrayscale(v);
    regenerate({ grayscale: v });
  }

  function onToggleBlur() {
    const v = blur > 0 ? 0 : 4;
    setBlur(v);
    regenerate({ blur: v });
  }

  function onPreset(w: number, h: number) {
    setWidth(w);
    setHeight(h);
    regenerate({ width: w, height: h });
  }

  function onClearSeed() {
    setSeed("");
    regenerate({ seed: "" });
  }

  function onDone() {
    closeWidget(`Placeholder image (${width}×${height}): ${url}`);
  }

  const markdown = [
    `### ${width}×${height}${grayscale ? " · grayscale" : ""}${blur ? ` · blur ${blur}` : ""}${seed ? ` · seed "${seed}"` : ""}`,
    "",
    `![placeholder](${url})`,
    "",
    `\`${url}\``,
    "",
    `_picsum.photos · [reload page](${url})_`,
  ].join("\n");

  return (
    <Form
      header={<CardHeader title="Lorem Picsum" iconBundleId="com.apple.Preview" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Generate" onSubmit={onGenerate} style="primary" />
          <Action title="16:9 (1280×720)" onAction={() => onPreset(1280, 720)} style="secondary" />
          <Action title="Square (600)" onAction={() => onPreset(600, 600)} style="secondary" />
          <Action title="Avatar (256)" onAction={() => onPreset(256, 256)} style="secondary" />
          <Action
            title={grayscale ? "Color" : "Grayscale"}
            onAction={onToggleGray}
            style="secondary"
          />
          <Action
            title={blur > 0 ? "Sharpen" : "Blur"}
            onAction={onToggleBlur}
            style="secondary"
          />
          <Action title="Clear seed" onAction={onClearSeed} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.NumberField
        name="width"
        label="Width"
        value={width}
        onChange={(v) => setWidth(clamp(Number(v) || 1, 1, 5000, 600))}
      />
      <Form.NumberField
        name="height"
        label="Height"
        value={height}
        onChange={(v) => setHeight(clamp(Number(v) || 1, 1, 5000, 400))}
      />
      <Form.NumberField
        name="blur"
        label="Blur (0–10)"
        value={blur}
        onChange={(v) => setBlur(clamp(Number(v) || 0, 0, 10, 0))}
      />
      <Form.TextField
        name="seed"
        label="Seed (optional, deterministic)"
        value={seed}
        onChange={setSeed}
      />
    </Form>
  );
}

const PicsumWidget = defineWidget({
  name: "placeholder_image",
  description:
    "Generate placeholder images via Lorem Picsum (picsum.photos). Configurable width, height, grayscale, blur (1–10). Optional seed produces deterministic images. Includes 16:9, square, and avatar size presets.",
  schema,
  component: PlaceholderImage,
});

export default PicsumWidget;
