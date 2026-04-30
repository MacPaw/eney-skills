import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { spawn } from "node:child_process";

const schema = z.object({
  text: z.string().optional().describe("The text to speak aloud."),
  voice: z.string().optional().describe("The macOS voice to use (e.g. 'Samantha', 'Daniel'). Optional."),
  rate: z.number().int().optional().describe("Words per minute. Defaults to the system rate (~175)."),
});

type Props = z.infer<typeof schema>;

interface Voice {
  name: string;
  locale: string;
}

async function listVoices(): Promise<Voice[]> {
  return await new Promise((resolve, reject) => {
    const child = spawn("say", ["-v", "?"]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `say exited with code ${code}`));
        return;
      }
      const voices: Voice[] = [];
      for (const line of stdout.split("\n")) {
        const match = line.match(/^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})\b/);
        if (match) voices.push({ name: match[1].trim(), locale: match[2] });
      }
      voices.sort((a, b) => a.name.localeCompare(b.name));
      resolve(voices);
    });
  });
}

async function speak(text: string, voice: string, rate: number | null): Promise<void> {
  const args: string[] = [];
  if (voice) args.push("-v", voice);
  if (rate !== null && rate > 0) args.push("-r", String(rate));
  args.push("--", text);
  return await new Promise((resolve, reject) => {
    const child = spawn("say", args);
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `say exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function SayText(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [voice, setVoice] = useState(props.voice ?? "");
  const [rate, setRate] = useState<number | null>(props.rate ?? null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listVoices()
      .then(setVoices)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function onSubmit() {
    if (!text.trim()) return;
    setIsSpeaking(true);
    setError("");
    try {
      await speak(text, voice, rate);
      closeWidget(`Spoken: "${text.length > 60 ? text.slice(0, 57) + "..." : text}"`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsSpeaking(false);
    }
  }

  return (
    <Form
      header={<CardHeader title="Speak Text" iconBundleId="com.apple.SpeechSynthesizer" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSpeaking ? "Speaking..." : "Speak"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSpeaking}
            isDisabled={!text.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.Dropdown name="voice" label="Voice" value={voice} onChange={setVoice} searchable>
        <Form.Dropdown.Item title="System default" value="" />
        {voices.map((v) => (
          <Form.Dropdown.Item key={v.name} title={`${v.name} (${v.locale})`} value={v.name} />
        ))}
      </Form.Dropdown>
      <Form.NumberField name="rate" label="Rate (words/minute)" value={rate} onChange={setRate} min={50} max={500} />
    </Form>
  );
}

const SayTextWidget = defineWidget({
  name: "say-text",
  description: "Speak text aloud using the macOS built-in say command, with optional voice and rate selection.",
  schema,
  component: SayText,
});

export default SayTextWidget;
