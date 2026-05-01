import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({});

type Props = z.infer<typeof schema>;

async function fetchZen(): Promise<string> {
  const res = await fetch("https://api.github.com/zen", {
    headers: {
      Accept: "text/plain",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return (await res.text()).trim();
}

function GithubZen(_props: Props) {
  const closeWidget = useCloseWidget();
  const [zen, setZen] = useState("");
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchZen()
      .then((z) => {
        if (cancelled) return;
        setZen(z);
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
    closeWidget(zen ? `GitHub Zen: ${zen}` : errorMsg ? `Error: ${errorMsg}` : "Closed.");
  }

  const markdown =
    status === "loading"
      ? "_Listening to GitHub…_ 🧘"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : zen
          ? [`> ${zen}`, "", `_GitHub Zen · api.github.com/zen_`].join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title="GitHub Zen 🧘" iconBundleId="com.apple.dt.Xcode" />}
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

const GithubZenWidget = defineWidget({
  name: "get_github_zen",
  description:
    "Get a random GitHub Zen quote — the design philosophy slogans returned by api.github.com/zen.",
  schema,
  component: GithubZen,
});

export default GithubZenWidget;
