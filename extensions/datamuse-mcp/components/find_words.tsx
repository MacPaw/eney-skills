import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

type Mode =
  | "synonyms"
  | "antonyms"
  | "rhymes"
  | "near_rhymes"
  | "related"
  | "homophones"
  | "describes"
  | "described_by"
  | "spelled_like";

const MODES: Mode[] = [
  "synonyms",
  "antonyms",
  "rhymes",
  "near_rhymes",
  "related",
  "homophones",
  "describes",
  "described_by",
  "spelled_like",
];

const MODE_LABEL: Record<Mode, string> = {
  synonyms: "Synonyms",
  antonyms: "Antonyms",
  rhymes: "Rhymes",
  near_rhymes: "Near rhymes",
  related: "Related",
  homophones: "Homophones",
  describes: "Adjectives that describe this noun",
  described_by: "Nouns this adjective describes",
  spelled_like: "Spelled like (wildcard)",
};

const schema = z.object({
  word: z.string().describe("Word or pattern to query."),
  mode: z
    .enum([
      "synonyms",
      "antonyms",
      "rhymes",
      "near_rhymes",
      "related",
      "homophones",
      "describes",
      "described_by",
      "spelled_like",
    ])
    .optional()
    .describe("Which lookup to perform. Defaults to 'synonyms'."),
  limit: z.number().int().optional().describe("Max results. Defaults to 30. Max 100."),
});

type Props = z.infer<typeof schema>;

interface DatamuseHit {
  word: string;
  score?: number;
}

function buildUrl(word: string, mode: Mode, limit: number): string {
  const params = new URLSearchParams();
  const w = encodeURIComponent(word.trim());
  // Datamuse uses different rel_* / sl / sp params per mode
  const map: Record<Mode, string> = {
    synonyms: `rel_syn=${w}`,
    antonyms: `rel_ant=${w}`,
    rhymes: `rel_rhy=${w}`,
    near_rhymes: `rel_nry=${w}`,
    related: `ml=${w}`, // means-like
    homophones: `rel_hom=${w}`,
    describes: `rel_jjb=${w}`,
    described_by: `rel_jja=${w}`,
    spelled_like: `sp=${w}`,
  };
  params.set("max", String(Math.max(1, Math.min(100, limit))));
  return `https://api.datamuse.com/words?${map[mode]}&${params.toString()}`;
}

async function fetchWords(word: string, mode: Mode, limit: number): Promise<DatamuseHit[]> {
  if (!word.trim()) return [];
  const res = await fetch(buildUrl(word, mode, limit));
  if (!res.ok) throw new Error(`Datamuse error ${res.status}`);
  return (await res.json()) as DatamuseHit[];
}

function buildMarkdown(word: string, mode: Mode, hits: DatamuseHit[]): string {
  if (hits.length === 0) return `_No ${MODE_LABEL[mode].toLowerCase()} found for "${word}"._`;
  const lines: string[] = [];
  lines.push(`### ${MODE_LABEL[mode]} for "${word}"`);
  lines.push(`**${hits.length}** result${hits.length === 1 ? "" : "s"}`);
  lines.push("");
  // Group into rows of 5 for compactness
  const cols = 5;
  for (let i = 0; i < hits.length; i += cols) {
    const row = hits.slice(i, i + cols).map((h) => `\`${h.word}\``).join(" · ");
    lines.push(`- ${row}`);
  }
  lines.push("");
  lines.push(`_Source: api.datamuse.com_`);
  return lines.join("\n");
}

function FindWords(props: Props) {
  const closeWidget = useCloseWidget();
  const [word, setWord] = useState(props.word);
  const [mode, setMode] = useState<Mode>((props.mode ?? "synonyms") as Mode);
  const limit = Math.max(1, Math.min(100, props.limit ?? 30));
  const [hits, setHits] = useState<DatamuseHit[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchWords(word, mode, limit)
      .then((h) => {
        if (cancelled) return;
        setHits(h);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount, mode]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onSetMode(m: Mode) {
    setMode(m);
  }

  function onDone() {
    if (hits.length === 0) {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : `No ${mode} for "${word}".`);
      return;
    }
    closeWidget(
      `${MODE_LABEL[mode]} for "${word}": ${hits.map((h) => h.word).join(", ")}`,
    );
  }

  const markdown =
    status === "loading"
      ? "_Looking up words…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : buildMarkdown(word, mode, hits);

  return (
    <Form
      header={<CardHeader title={`Word Tools — ${MODE_LABEL[mode]}`} iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Synonyms" onAction={() => onSetMode("synonyms")} style="secondary" />
          <Action title="Antonyms" onAction={() => onSetMode("antonyms")} style="secondary" />
          <Action title="Rhymes" onAction={() => onSetMode("rhymes")} style="secondary" />
          <Action title="Near rhymes" onAction={() => onSetMode("near_rhymes")} style="secondary" />
          <Action title="Related" onAction={() => onSetMode("related")} style="secondary" />
          <Action title="Homophones" onAction={() => onSetMode("homophones")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="word" label="Word or pattern" value={word} onChange={setWord} />
    </Form>
  );
}

const WordToolsWidget = defineWidget({
  name: "find_words",
  description:
    "Find synonyms, antonyms, rhymes, near-rhymes, related ('means like'), homophones, and adjective/noun pairs for a word using the free Datamuse API. Wildcard 'spelled_like' mode supports * and ? patterns.",
  schema,
  component: FindWords,
});

export default WordToolsWidget;
