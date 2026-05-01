import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  question: z.string().optional().describe("Optional yes/no question to display alongside the answer."),
  force: z
    .enum(["yes", "no", "maybe"])
    .optional()
    .describe("Force a specific answer (for fun / demos)."),
});

type Props = z.infer<typeof schema>;

interface Verdict {
  answer: "yes" | "no" | "maybe";
  image: string;
}

async function fetchVerdict(force?: "yes" | "no" | "maybe"): Promise<Verdict> {
  const url = force ? `https://yesno.wtf/api?force=${force}` : "https://yesno.wtf/api";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`yesno.wtf error ${res.status}`);
  const data = (await res.json()) as { answer: "yes" | "no" | "maybe"; image: string };
  return { answer: data.answer, image: data.image };
}

const EMOJI: Record<Verdict["answer"], string> = {
  yes: "✅",
  no: "❌",
  maybe: "🤷",
};

function YesNoOracle(props: Props) {
  const closeWidget = useCloseWidget();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [forced, setForced] = useState<Props["force"]>(props.force);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchVerdict(forced)
      .then((v) => {
        if (cancelled) return;
        setVerdict(v);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount, forced]);

  function onAsk() {
    setForced(undefined);
    setReloadCount((c) => c + 1);
  }

  function onForce(v: "yes" | "no" | "maybe") {
    setForced(v);
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (verdict) {
      closeWidget(`${EMOJI[verdict.answer]} ${verdict.answer.toUpperCase()}${props.question ? ` — to "${props.question}"` : ""}.`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Consulting the oracle…_ 🔮"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : verdict
          ? [
              ...(props.question ? [`> ${props.question}`, ""] : []),
              `### ${EMOJI[verdict.answer]} **${verdict.answer.toUpperCase()}**`,
              "",
              `![${verdict.answer}](${verdict.image})`,
              "",
              `_yesno.wtf_`,
            ].join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title="Yes / No Oracle" iconBundleId="com.apple.Emoji" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Ask again" onAction={onAsk} style="primary" />
          <Action title="Force yes" onAction={() => onForce("yes")} style="secondary" />
          <Action title="Force no" onAction={() => onForce("no")} style="secondary" />
          <Action title="Force maybe" onAction={() => onForce("maybe")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const YesNoWidget = defineWidget({
  name: "yes_no_oracle",
  description:
    "Random yes / no / maybe answer with a reaction GIF, sourced from yesno.wtf. Optional question prop displays the question alongside the verdict; optional force lets you fix the answer.",
  schema,
  component: YesNoOracle,
});

export default YesNoWidget;
