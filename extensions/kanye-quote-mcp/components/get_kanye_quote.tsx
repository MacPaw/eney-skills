import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({});

type Props = z.infer<typeof schema>;

async function fetchQuote(): Promise<string> {
  const res = await fetch(`https://api.kanye.rest?_=${Date.now()}`);
  if (!res.ok) throw new Error(`kanye.rest error ${res.status}`);
  const data = (await res.json()) as { quote: string };
  return data.quote;
}

function KanyeQuote(_props: Props) {
  const closeWidget = useCloseWidget();
  const [quote, setQuote] = useState("");
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
    closeWidget(quote ? `"${quote}" — Kanye West (kanye.rest)` : errorMsg ? `Error: ${errorMsg}` : "Closed.");
  }

  const markdown =
    status === "loading"
      ? "_Loading…_ 🎤"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : quote
          ? [`> ${quote}`, "", `— **Kanye West**`, "", `_kanye.rest_`].join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title="Kanye Quote" iconBundleId="com.apple.Music" />}
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

const KanyeWidget = defineWidget({
  name: "get_kanye_quote",
  description:
    "Get a random Kanye West quote from api.kanye.rest (free, no key). Cache-busts the request to avoid stale CDN responses.",
  schema,
  component: KanyeQuote,
});

export default KanyeWidget;
