import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  word: z.string().optional().describe("The English word to define."),
});

type Props = z.infer<typeof schema>;

interface Definition {
  definition: string;
  example?: string;
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

interface Phonetic {
  text?: string;
}

interface Entry {
  word: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
}

const ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en";
const MAX_DEFINITIONS_PER_MEANING = 3;

async function fetchEntries(word: string): Promise<Entry[]> {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(word)}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Dictionary API returned ${res.status}`);
  const json = (await res.json()) as Entry[];
  return Array.isArray(json) ? json : [];
}

function renderEntries(word: string, entries: Entry[]): string {
  if (!entries.length) return `_No definitions found for **${word}**._`;
  const lines: string[] = [];
  const phonetic = entries.find((e) => e.phonetics?.some((p) => p.text))?.phonetics.find((p) => p.text)?.text;
  lines.push(`### ${entries[0].word}${phonetic ? ` _${phonetic}_` : ""}`);
  for (const entry of entries) {
    for (const meaning of entry.meanings ?? []) {
      lines.push("");
      lines.push(`**${meaning.partOfSpeech}**`);
      const defs = meaning.definitions.slice(0, MAX_DEFINITIONS_PER_MEANING);
      defs.forEach((d, i) => {
        lines.push(`${i + 1}. ${d.definition}`);
        if (d.example) lines.push(`   _e.g._ ${d.example}`);
      });
    }
  }
  return lines.join("\n");
}

function DefineWord(props: Props) {
  const closeWidget = useCloseWidget();
  const [word, setWord] = useState(props.word ?? "");
  const [result, setResult] = useState<{ word: string; entries: Entry[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    const trimmed = word.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError("");
    try {
      const entries = await fetchEntries(trimmed);
      setResult({ word: trimmed, entries });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onDone() {
    if (!result) {
      closeWidget("Lookup cancelled.");
      return;
    }
    if (!result.entries.length) {
      closeWidget(`No definitions found for "${result.word}".`);
      return;
    }
    closeWidget(`Looked up "${result.word}".`);
  }

  const header = <CardHeader title="Dictionary" iconBundleId="com.apple.Dictionary" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="New Lookup" onSubmit={() => setResult(null)} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={renderEntries(result.word, result.entries)} />
        <Form.TextField name="word" label="Word" value={word} onChange={setWord} isCopyable />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Looking up..." : "Define"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!word.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="word" label="Word" value={word} onChange={setWord} />
    </Form>
  );
}

const DefineWordWidget = defineWidget({
  name: "define-word",
  description: "Look up the definition of an English word using the Free Dictionary API.",
  schema,
  component: DefineWord,
});

export default DefineWordWidget;
