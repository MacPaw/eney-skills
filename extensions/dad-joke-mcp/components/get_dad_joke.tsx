import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  searchTerm: z
    .string()
    .optional()
    .describe("Optional keyword to search for a specific type of dad joke, e.g. 'cat', 'dog', 'science'."),
});

type Props = z.infer<typeof schema>;

const USER_AGENT = "eney-skills-mcp/1.0 (https://github.com/MacPaw/eney-skills)";

interface DadJoke {
  id: string;
  joke: string;
}

async function fetchJoke(searchTerm?: string): Promise<DadJoke> {
  const url = searchTerm
    ? `https://icanhazdadjoke.com/search?term=${encodeURIComponent(searchTerm)}&limit=10`
    : "https://icanhazdadjoke.com/";
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch joke: ${res.status}`);

  if (searchTerm) {
    const data = await res.json() as { results: DadJoke[]; total_jokes: number };
    if (!data.results || data.results.length === 0) {
      throw new Error(`No jokes found for "${searchTerm}"`);
    }
    const pick = data.results[Math.floor(Math.random() * data.results.length)];
    return pick;
  }

  return res.json() as Promise<DadJoke>;
}

function DadJokeWidget(props: Props) {
  const closeWidget = useCloseWidget();
  const [joke, setJoke] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchJoke(props.searchTerm)
      .then((data) => {
        if (cancelled) return;
        setJoke(data.joke);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [loadCount]);

  function onAnother() {
    setLoadCount((c) => c + 1);
  }

  function onDone() {
    closeWidget(joke || "No joke loaded.");
  }

  const markdown =
    status === "loading"
      ? "_Loading joke…_ 🥁"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : `> ${joke}`;

  return (
    <Form
      header={<CardHeader title="Dad Joke 🥁" iconBundleId="com.apple.Emoji" />}
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

const DadJokeWidgetDef = defineWidget({
  name: "get_dad_joke",
  description:
    "Get a random dad joke from icanhazdadjoke.com to lighten the mood. Optionally search by keyword.",
  schema,
  component: DadJokeWidget,
});

export default DadJokeWidgetDef;
