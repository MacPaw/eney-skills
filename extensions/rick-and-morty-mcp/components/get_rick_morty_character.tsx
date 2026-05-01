import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  query: z.string().describe("Character name (e.g. 'Rick Sanchez') or numeric ID (e.g. '1')."),
});

type Props = z.infer<typeof schema>;

interface Character {
  id: number;
  name: string;
  status: string;
  species: string;
  type: string;
  gender: string;
  origin: string;
  location: string;
  image: string;
  episodes: number;
  url: string;
}

interface RawCharacter {
  id: number;
  name: string;
  status: string;
  species: string;
  type: string;
  gender: string;
  origin: { name: string };
  location: { name: string };
  image: string;
  episode: string[];
  url: string;
}

function normalize(c: RawCharacter): Character {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    species: c.species,
    type: c.type,
    gender: c.gender,
    origin: c.origin.name,
    location: c.location.name,
    image: c.image,
    episodes: c.episode.length,
    url: c.url,
  };
}

async function fetchCharacter(query: string): Promise<Character> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Empty query.");
  if (/^\d+$/.test(trimmed)) {
    const res = await fetch(`https://rickandmortyapi.com/api/character/${trimmed}`);
    if (res.status === 404) throw new Error(`No character with ID ${trimmed}.`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return normalize((await res.json()) as RawCharacter);
  }
  const res = await fetch(`https://rickandmortyapi.com/api/character/?name=${encodeURIComponent(trimmed)}`);
  if (res.status === 404) throw new Error(`No character matching "${trimmed}".`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = (await res.json()) as { results?: RawCharacter[] };
  if (!data.results || data.results.length === 0) throw new Error(`No character matching "${trimmed}".`);
  return normalize(data.results[0]);
}

function statusEmoji(s: string): string {
  if (/alive/i.test(s)) return "🟢";
  if (/dead/i.test(s)) return "💀";
  return "❔";
}

function buildMarkdown(c: Character): string {
  return [
    `![${c.name}](${c.image})`,
    "",
    `### #${c.id} — ${c.name}`,
    "",
    `| | |`,
    `|---|---|`,
    `| Status | ${statusEmoji(c.status)} ${c.status} |`,
    `| Species | ${c.species}${c.type ? ` (${c.type})` : ""} |`,
    `| Gender | ${c.gender} |`,
    `| Origin | ${c.origin} |`,
    `| Last seen | ${c.location} |`,
    `| Episodes | ${c.episodes} |`,
  ].join("\n");
}

function RickMorty(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query);
  const [character, setCharacter] = useState<Character | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchCharacter(query)
      .then((c) => {
        if (cancelled) return;
        setCharacter(c);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onRandom() {
    // 826 characters as of writing — we'll hop within a safe range.
    const id = Math.floor(Math.random() * 826) + 1;
    setQuery(String(id));
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (character) {
      closeWidget(`#${character.id} ${character.name} — ${character.species}, ${character.status}. Origin: ${character.origin}. Last seen: ${character.location}. ${character.episodes} episodes.`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Looking up character…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : character
          ? buildMarkdown(character)
          : "";

  return (
    <Form
      header={<CardHeader title="Rick & Morty" iconBundleId="com.apple.gamecontroller" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Random" onAction={onRandom} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="query" label="Name or numeric ID" value={query} onChange={setQuery} />
    </Form>
  );
}

const RickMortyWidget = defineWidget({
  name: "get_rick_morty_character",
  description:
    "Look up a Rick and Morty character by name or numeric ID via rickandmortyapi.com (free, no key). Returns species, status, origin, last-seen location, episode count, and the official character art.",
  schema,
  component: RickMorty,
});

export default RickMortyWidget;
