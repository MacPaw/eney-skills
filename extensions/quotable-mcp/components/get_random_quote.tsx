import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  mode: z
    .enum(["random", "today"])
    .optional()
    .describe("'random' for any quote, 'today' for ZenQuotes' quote of the day. Defaults to random."),
});

type Props = z.infer<typeof schema>;

interface Quote {
  text: string;
  author: string;
}

interface ZenQuoteRaw {
  q: string;
  a: string;
  h?: string;
}

async function fetchQuote(mode: "random" | "today"): Promise<Quote> {
  const url = mode === "today" ? "https://zenquotes.io/api/today" : "https://zenquotes.io/api/random";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ZenQuotes error ${res.status}`);
  const data = await res.json() as ZenQuoteRaw[];
  if (!Array.isArray(data) || data.length === 0) throw new Error("Unexpected response from ZenQuotes.");
  const q = data[0];
  return { text: q.q, author: q.a };
}

function Quotable(props: Props) {
  const closeWidget = useCloseWidget();
  const mode = props.mode ?? "random";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchQuote(mode)
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
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onAnother() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (quote) {
      closeWidget(`"${quote.text}" — ${quote.author}`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Loading quote…_ ✨"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : quote
          ? [
              `> ${quote.text}`,
              ``,
              `— **${quote.author}**`,
              ``,
              `_Quotes provided by [ZenQuotes API](https://zenquotes.io/)_`,
            ].join("\n")
          : "";

  return (
    <Form
      header={
        <CardHeader
          title={mode === "today" ? "Quote of the Day" : "Random Quote"}
          iconBundleId="com.apple.iBooksX"
        />
      }
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

const QuotableWidget = defineWidget({
  name: "get_random_quote",
  description:
    "Get a random inspirational quote (or quote of the day) from the free ZenQuotes API. Attribution to zenquotes.io is included as required by their terms.",
  schema,
  component: Quotable,
});

export default QuotableWidget;
