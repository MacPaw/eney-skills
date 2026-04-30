import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import figlet from "figlet";

const schema = z.object({
  text: z.string().optional().describe("The text to render."),
  font: z.string().optional().describe("Figlet font name. Defaults to 'Standard'."),
});

type Props = z.infer<typeof schema>;

const PRESET_FONTS: string[] = [
  "Standard",
  "Slant",
  "Big",
  "Small",
  "Doom",
  "Block",
  "Banner",
  "Shadow",
  "Star Wars",
  "Ghost",
  "ANSI Shadow",
  "Larry 3D",
  "Univers",
];

interface RenderOk {
  ok: true;
  text: string;
}

interface RenderErr {
  ok: false;
  error: string;
}

async function renderText(text: string, font: string): Promise<RenderOk | RenderErr> {
  return await new Promise((resolve) => {
    figlet.text(text, { font }, (err, data) => {
      if (err) resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      else resolve({ ok: true, text: data ?? "" });
    });
  });
}

function GenerateAsciiArt(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "Hello");
  const [font, setFont] = useState<string>(props.font ?? "Standard");
  const [output, setOutput] = useState<RenderOk | RenderErr | null>(null);

  useEffect(() => {
    if (!text) {
      setOutput(null);
      return;
    }
    let cancelled = false;
    renderText(text, font).then((r) => {
      if (!cancelled) setOutput(r);
    });
    return () => {
      cancelled = true;
    };
  }, [text, font]);

  function onDone() {
    if (output?.ok) closeWidget("ASCII art generated.");
    else if (output && !output.ok) closeWidget(`Error: ${output.error}`);
    else closeWidget("Nothing rendered.");
  }

  const renderedText = useMemo(() => (output?.ok ? output.text : ""), [output]);

  return (
    <Form
      header={<CardHeader title="ASCII Art" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {renderedText && <Action.CopyToClipboard title="Copy" content={renderedText} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.Dropdown name="font" label="Font" value={font} onChange={(v) => setFont(v)} searchable>
        {PRESET_FONTS.map((f) => (
          <Form.Dropdown.Item key={f} title={f} value={f} />
        ))}
      </Form.Dropdown>
      {output && !output.ok && <Paper markdown={`**Error:** ${output.error}`} />}
      {renderedText && <Paper markdown={"```\n" + renderedText + "\n```"} />}
    </Form>
  );
}

const GenerateAsciiArtWidget = defineWidget({
  name: "generate-ascii-art",
  description:
    "Render text as ASCII art using the figlet package. Pick from 13 preset fonts (Standard, Slant, Big, Small, Doom, Block, Banner, Shadow, Star Wars, Ghost, ANSI Shadow, Larry 3D, Univers).",
  schema,
  component: GenerateAsciiArt,
});

export default GenerateAsciiArtWidget;
