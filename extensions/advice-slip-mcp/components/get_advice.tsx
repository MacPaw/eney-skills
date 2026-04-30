import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  searchTerm: z.string().optional().describe("Optional keyword to search advice for, e.g. 'love', 'work'."),
});

type Props = z.infer<typeof schema>;

interface Slip {
  id: number;
  advice: string;
}

async function fetchAdvice(searchTerm?: string): Promise<Slip> {
  const term = searchTerm?.trim();
  if (term) {
    const url = `https://api.adviceslip.com/advice/search/${encodeURIComponent(term)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`adviceslip.com error ${res.status}`);
    const data = await res.json() as { slips?: Slip[]; message?: { type: string; text: string } };
    if (data.message) {
      throw new Error(data.message.text);
    }
    if (!data.slips || data.slips.length === 0) {
      throw new Error(`No advice found for "${term}"`);
    }
    return data.slips[Math.floor(Math.random() * data.slips.length)];
  }
  // Append cache-busting param so we don't hit a stale CDN-cached random
  const res = await fetch(`https://api.adviceslip.com/advice?_=${Date.now()}`);
  if (!res.ok) throw new Error(`adviceslip.com error ${res.status}`);
  const data = await res.json() as { slip: Slip };
  return data.slip;
}

function AdviceSlip(props: Props) {
  const closeWidget = useCloseWidget();
  const [slip, setSlip] = useState<Slip | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchAdvice(props.searchTerm)
      .then((s) => {
        if (cancelled) return;
        setSlip(s);
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
    if (slip) {
      closeWidget(`"${slip.advice}" — adviceslip #${slip.id}`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Loading advice…_ ✨"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : slip
          ? [
              `> ${slip.advice}`,
              ``,
              `_Slip #${slip.id} · adviceslip.com_`,
            ].join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title="Random Advice" iconBundleId="com.apple.iBooksX" />}
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

const AdviceSlipWidget = defineWidget({
  name: "get_advice",
  description:
    "Get a random piece of advice from the free adviceslip.com API. Optional searchTerm filters by keyword (e.g. 'love', 'work').",
  schema,
  component: AdviceSlip,
});

export default AdviceSlipWidget;
