import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({});

type Props = z.infer<typeof schema>;

interface AnimeQuote {
  content: string;
  anime: string;
  character: string;
}

interface RawResponse {
  status: string;
  data: {
    content: string;
    anime: { name: string; altName?: string };
    character: { name: string };
  };
}

async function fetchQuote(): Promise<AnimeQuote> {
  const res = await fetch(`https://api.animechan.io/v1/quotes/random?_=${Date.now()}`);
  if (!res.ok) throw new Error(`animechan.io error ${res.status}`);
  const raw = (await res.json()) as RawResponse;
  if (raw.status !== "success") throw new Error("Unexpected API response.");
  return {
    content: raw.data.content,
    anime: raw.data.anime.name,
    character: raw.data.character.name,
  };
}

function AnimeQuote(_props: Props) {
  const closeWidget = useCloseWidget();
  const [quote, setQuote] = useState<AnimeQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchQuote()
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onAnother() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (quote) {
      closeWidget(`"${quote.content}" — ${quote.character}, ${quote.anime}`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Loading…_ ✨"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : quote
          ? [
              `> ${quote.content}`,
              "",
              `— **${quote.character}**, _${quote.anime}_`,
              "",
              `_animechan.io_`,
            ].join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title="Anime Quote" iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Another" onAction={onAnother} style="secondary" />
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const AnimeQuoteWidget = defineWidget({
  name: "get_anime_quote",
  description:
    "Get a random anime quote with character + anime attribution from animechan.io. Cache-busts the request to avoid stale CDN responses.",
  schema,
  component: AnimeQuote,
});

export default AnimeQuoteWidget;
