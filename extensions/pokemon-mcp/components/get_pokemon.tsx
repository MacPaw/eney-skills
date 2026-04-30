import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  query: z
    .string()
    .describe("Pokémon name or Pokédex number, e.g. 'pikachu', '25', 'charizard'."),
});

type Props = z.infer<typeof schema>;

interface Pokemon {
  id: number;
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  types: string[];
  abilities: string[];
  stats: { name: string; value: number }[];
  spriteUrl: string | null;
}

interface PokeApiRaw {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { type: { name: string } }[];
  abilities: { ability: { name: string }; is_hidden: boolean }[];
  stats: { base_stat: number; stat: { name: string } }[];
  sprites: {
    other?: { ["official-artwork"]?: { front_default?: string | null } };
    front_default?: string | null;
  };
}

async function fetchPokemon(query: string): Promise<Pokemon> {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) throw new Error("Empty query.");
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(cleaned)}`);
  if (res.status === 404) {
    throw new Error(`No Pokémon found for "${query}".`);
  }
  if (!res.ok) throw new Error(`PokeAPI error ${res.status}`);
  const data = await res.json() as PokeApiRaw;
  return {
    id: data.id,
    name: data.name,
    height: data.height,
    weight: data.weight,
    types: data.types.map((t) => t.type.name),
    abilities: data.abilities.map((a) => `${a.ability.name}${a.is_hidden ? " (hidden)" : ""}`),
    stats: data.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    spriteUrl:
      data.sprites.other?.["official-artwork"]?.front_default ??
      data.sprites.front_default ??
      null,
  };
}

const TYPE_EMOJI: Record<string, string> = {
  normal: "⚪",
  fire: "🔥",
  water: "💧",
  electric: "⚡",
  grass: "🌿",
  ice: "❄️",
  fighting: "🥊",
  poison: "☠️",
  ground: "⛰️",
  flying: "🪽",
  psychic: "🔮",
  bug: "🐛",
  rock: "🪨",
  ghost: "👻",
  dragon: "🐉",
  dark: "🌑",
  steel: "🔩",
  fairy: "✨",
};

function buildMarkdown(p: Pokemon): string {
  const heightM = (p.height / 10).toFixed(1);
  const weightKg = (p.weight / 10).toFixed(1);
  const types = p.types.map((t) => `${TYPE_EMOJI[t] ?? "•"} ${t}`).join(", ");
  const lines: string[] = [];
  if (p.spriteUrl) lines.push(`![${p.name}](${p.spriteUrl})`);
  lines.push(`### #${p.id.toString().padStart(3, "0")} — ${p.name[0].toUpperCase() + p.name.slice(1)}`);
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Type | ${types} |`);
  lines.push(`| Height | ${heightM} m |`);
  lines.push(`| Weight | ${weightKg} kg |`);
  lines.push(`| Abilities | ${p.abilities.join(", ")} |`);
  lines.push("");
  lines.push("**Base stats**");
  for (const s of p.stats) {
    const bar = "█".repeat(Math.min(20, Math.round(s.value / 10)));
    lines.push(`- ${s.name.padEnd(15)} \`${bar}\` ${s.value}`);
  }
  return lines.join("\n");
}

function Pokemon(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query);
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchPokemon(query)
      .then((p) => {
        if (cancelled) return;
        setPokemon(p);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onRandom() {
    const id = Math.floor(Math.random() * 1010) + 1; // up to gen 9
    setQuery(String(id));
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (pokemon) {
      const types = pokemon.types.join("/");
      closeWidget(
        `#${pokemon.id} ${pokemon.name} (${types}). ` +
        `${(pokemon.height / 10).toFixed(1)}m, ${(pokemon.weight / 10).toFixed(1)}kg. ` +
        `Abilities: ${pokemon.abilities.join(", ")}.`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Looking up Pokémon…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : pokemon
          ? buildMarkdown(pokemon)
          : "";

  return (
    <Form
      header={<CardHeader title="Pokémon" iconBundleId="com.apple.gamecontroller" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Random" onAction={onRandom} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="query"
        label="Pokémon name or number"
        value={query}
        onChange={setQuery}
      />
    </Form>
  );
}

const PokemonWidget = defineWidget({
  name: "get_pokemon",
  description:
    "Look up a Pokémon by name or Pokédex number using the free PokeAPI. Returns types, height, weight, abilities, base stats, and official artwork.",
  schema,
  component: Pokemon,
});

export default PokemonWidget;
