import { useState } from "react";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const TONE_OPTIONS = [
  { value: "Formal",       label: "🎩 Formal",       prompt: "formal and professional — use polished, structured language" },
  { value: "Casual",       label: "😊 Casual",        prompt: "casual and relaxed — use everyday conversational language" },
  { value: "Friendly",     label: "🤝 Friendly",      prompt: "warm and friendly — use approachable, upbeat language" },
  { value: "Professional", label: "💼 Professional",  prompt: "professional and business-appropriate — clear, concise, and authoritative" },
  { value: "Empathetic",   label: "💙 Empathetic",    prompt: "empathetic and compassionate — show genuine understanding and care" },
  { value: "Humorous",     label: "😄 Humorous",      prompt: "light-hearted and funny — add wit and playful humour where fitting" },
  { value: "Sarcastic",    label: "😏 Sarcastic",     prompt: "sarcastic and ironic — use dry wit and implied meaning" },
  { value: "Persuasive",   label: "🎯 Persuasive",    prompt: "persuasive and compelling — drive the reader toward a clear call to action" },
  { value: "Confident",    label: "💪 Confident",     prompt: "confident and assertive — use strong, decisive language without hedging" },
  { value: "Concise",      label: "✂️ Concise",       prompt: "concise and direct — remove filler words and get straight to the point" },
  { value: "Poetic",       label: "🌸 Poetic",        prompt: "poetic and expressive — use vivid imagery and lyrical phrasing" },
  { value: "Direct",       label: "⚡ Direct",         prompt: "direct and blunt — no softening, just clear plain statements" },
] as const;

type ToneValue = (typeof TONE_OPTIONS)[number]["value"] | "";

const schema = z.object({
  text: z.string().optional().describe("The text to rewrite in a different tone."),
  tone: z
    .string()
    .optional()
    .describe(
      "The target tone. One of: Formal, Casual, Friendly, Professional, Empathetic, Humorous, Sarcastic, Persuasive, Confident, Concise, Poetic, Direct."
    ),
});

type Props = z.infer<typeof schema>;

function ChangeTone(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [tone, setTone] = useState<ToneValue>((props.tone as ToneValue) ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const toneOption = TONE_OPTIONS.find((t) => t.value === tone);

  async function onSubmit() {
    if (!text.trim()) return;
    setIsLoading(true);
    setError("");
    setResult("");
    try {
      const client = new Anthropic();
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Rewrite the following text so it sounds ${toneOption!.prompt}. Keep the same language as the original — do not translate. Return only the rewritten text — no explanations, labels, or extra commentary.\n\n${text}`,
          },
        ],
      });
      const block = message.content[0];
      if (block.type === "text") {
        setResult(block.text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onStartOver() {
    setResult("");
    setError("");
  }

  function onDone() {
    closeWidget(result || "Done.");
  }

  if (result) {
    return (
      <Form
        header={<CardHeader title="Change Tone" iconBundleId="com.apple.TextEdit" />}
        actions={
          <ActionPanel layout="row">
            <Action.CopyToClipboard content={result} title="Copy Result" />
            <Action.SubmitForm title="Try Another Tone" onSubmit={onStartOver} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`**${toneOption?.label ?? tone} rewrite:**\n\n${result}`} />
      </Form>
    );
  }

  return (
    <Form
      header={<CardHeader title="Change Tone" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Rewriting…" : "Rewrite"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!text.trim() || !tone || isLoading}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.RichTextEditor value={text} onChange={setText} isInitiallyFocused />
      <Form.Dropdown name="tone" label="Tone" value={tone} onChange={(v) => setTone(v as ToneValue)} searchable>
        <Form.Dropdown.Item value="" title="Select a tone…" />
        {TONE_OPTIONS.map((t) => (
          <Form.Dropdown.Item key={t.value} title={t.label} value={t.value} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

const ChangeToneWidget = defineWidget({
  name: "change-tone",
  description:
    "Rewrite text in a different tone — formal, casual, friendly, professional, empathetic, humorous, sarcastic, persuasive, confident, concise, poetic, or direct",
  schema,
  component: ChangeTone,
});

export default ChangeToneWidget;
