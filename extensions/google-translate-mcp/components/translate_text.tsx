import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().describe("Text to translate."),
  to: z
    .string()
    .optional()
    .describe("Target language code (ISO 639-1), e.g. 'es', 'fr', 'ja', 'uk'. Defaults to 'en'."),
  from: z
    .string()
    .optional()
    .describe("Source language code, e.g. 'en'. Defaults to 'auto' (auto-detect)."),
});

type Props = z.infer<typeof schema>;

interface Translation {
  text: string;
  detectedLang: string;
  confidence: number;
  source: string;
  target: string;
}

interface RawResponse {
  // The unofficial endpoint returns a positional array.
  // Index 0: array of [translation, original, ...] segments
  // Index 2: detected source language
  // Index 6: confidence
  0?: [string, string, ...unknown[]][];
  2?: string;
  6?: number;
}

async function translate(text: string, from: string, to: string): Promise<Translation> {
  const params = new URLSearchParams({
    client: "gtx",
    sl: from || "auto",
    tl: to || "en",
    dt: "t",
    q: text,
  });
  const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translate endpoint error ${res.status}`);
  const data = (await res.json()) as RawResponse;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Unexpected translation response.");
  }
  const segments = data[0] as [string, string, ...unknown[]][];
  const translated = segments.map((s) => s[0]).join("");
  const detected = (data as { 2?: string })[2] ?? "?";
  const confidence = typeof (data as { 6?: number })[6] === "number" ? (data as { 6: number })[6] : 0;
  return {
    text: translated,
    detectedLang: detected,
    confidence,
    source: from || "auto",
    target: to || "en",
  };
}

const COMMON_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "uk", label: "Ukrainian" },
  { code: "ru", label: "Russian" },
];

function GoogleTranslate(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text);
  const [from, setFrom] = useState(props.from ?? "auto");
  const [to, setTo] = useState(props.to ?? "en");
  const [result, setResult] = useState<Translation | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!text.trim()) {
      setStatus("done");
      setResult(null);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    translate(text, from, to)
      .then((t) => {
        if (cancelled) return;
        setResult(t);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onTranslate() {
    setReloadCount((c) => c + 1);
  }

  function onSetTo(code: string) {
    setTo(code);
    setReloadCount((c) => c + 1);
  }

  function onSwap() {
    if (from === "auto") {
      // Use the detected language as the new source
      const detected = result?.detectedLang;
      if (detected && detected !== "?") {
        setFrom(to);
        setTo(detected);
      } else {
        setFrom(to);
      }
    } else {
      const oldFrom = from;
      setFrom(to);
      setTo(oldFrom);
    }
    if (result) setText(result.text);
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (result) {
      closeWidget(
        `${result.source} → ${result.target}: ${result.text}` +
        (from === "auto" ? ` (detected ${result.detectedLang})` : ""),
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  let markdown: string;
  if (status === "loading") {
    markdown = "_Translating…_";
  } else if (status === "error") {
    markdown = `**Error:** ${errorMsg}`;
  } else if (result) {
    markdown = [
      `### ${result.source === "auto" ? `auto (${result.detectedLang})` : result.source} → **${result.target}**`,
      "",
      "```",
      result.text,
      "```",
      "",
      `_${result.confidence > 0 ? `confidence ${(result.confidence * 100).toFixed(0)}% · ` : ""}translate.googleapis.com (no key)_`,
    ].join("\n");
  } else {
    markdown = "_Enter text and tap Translate._";
  }

  return (
    <Form
      header={<CardHeader title={`Translate · ${from} → ${to}`} iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Translate" onSubmit={onTranslate} style="primary" />
          <Action title="Swap" onAction={onSwap} style="secondary" />
          {COMMON_LANGS.slice(0, 7).map((l) => (
            <Action key={l.code} title={l.label} onAction={() => onSetTo(l.code)} style="secondary" />
          ))}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.TextField name="from" label="From (auto / ISO code)" value={from} onChange={setFrom} />
      <Form.TextField name="to" label="To (ISO code)" value={to} onChange={setTo} />
    </Form>
  );
}

const TranslateWidget = defineWidget({
  name: "translate_text",
  description:
    "Translate text between languages using Google Translate's public endpoint (translate.googleapis.com — no API key). Auto-detects source language by default; preset target buttons for common languages; Swap flips source and target.",
  schema,
  component: GoogleTranslate,
});

export default TranslateWidget;
