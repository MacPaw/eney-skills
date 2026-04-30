import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const CATEGORIES = [
  "animal", "career", "celebrity", "dev", "explicit", "fashion", "food",
  "history", "money", "movie", "music", "political", "religion", "science",
  "sport", "travel",
] as const;

const schema = z.object({
  category: z
    .enum(CATEGORIES)
    .optional()
    .describe(`Optional category for the joke. One of: ${CATEGORIES.join(", ")}.`),
});

type Props = z.infer<typeof schema>;

interface Joke {
  id: string;
  value: string;
  url: string;
  categories: string[];
}

async function fetchJoke(category?: string): Promise<Joke> {
  const url = category
    ? `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(category)}`
    : "https://api.chucknorris.io/jokes/random";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json() as Promise<Joke>;
}

function ChuckNorris(props: Props) {
  const closeWidget = useCloseWidget();
  const [joke, setJoke] = useState("");
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchJoke(props.category)
      .then((j) => {
        if (cancelled) return;
        setJoke(j.value);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  const markdown =
    status === "loading"
      ? "_Loading joke…_ 🥋"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : `> ${joke}`;

  function onAnother() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    closeWidget(joke || "No joke loaded.");
  }

  return (
    <Form
      header={<CardHeader title="Chuck Norris" iconBundleId="com.apple.Emoji" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Another One" onAction={onAnother} style="secondary" />
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const ChuckNorrisWidget = defineWidget({
  name: "get_chuck_norris_joke",
  description:
    "Get a random Chuck Norris joke from api.chucknorris.io. Optionally filter by category.",
  schema,
  component: ChuckNorris,
});

export default ChuckNorrisWidget;
