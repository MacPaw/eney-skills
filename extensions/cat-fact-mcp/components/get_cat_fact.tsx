import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  maxLength: z
    .number()
    .int()
    .optional()
    .describe("Maximum fact length in characters. Defaults to no limit."),
});

type Props = z.infer<typeof schema>;

interface CatFact {
  fact: string;
  length: number;
}

async function fetchFact(maxLength?: number): Promise<CatFact> {
  const url = maxLength
    ? `https://catfact.ninja/fact?max_length=${encodeURIComponent(String(maxLength))}`
    : "https://catfact.ninja/fact";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`catfact.ninja error ${res.status}`);
  const data = await res.json() as CatFact;
  return data;
}

function CatFactWidget(props: Props) {
  const closeWidget = useCloseWidget();
  const [fact, setFact] = useState<CatFact | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchFact(props.maxLength)
      .then((f) => {
        if (cancelled) return;
        setFact(f);
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
    if (fact) {
      closeWidget(fact.fact);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Fetching fact…_ 🐱"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : fact
          ? [`> ${fact.fact}`, ``, `_${fact.length} characters · catfact.ninja_`].join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title="Cat Fact 🐱" iconBundleId="com.apple.Emoji" />}
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

const CatFactWidgetDef = defineWidget({
  name: "get_cat_fact",
  description:
    "Get a random cat fact from catfact.ninja (free, no key). Optional max_length to bound the fact length.",
  schema,
  component: CatFactWidget,
});

export default CatFactWidgetDef;
