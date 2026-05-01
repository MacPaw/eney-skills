import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  stacks: z
    .string()
    .describe("Comma-separated stack names, e.g. 'node,macos,vscode' or 'python,django'."),
});

type Props = z.infer<typeof schema>;

const COMMON_PRESETS: { label: string; stacks: string }[] = [
  { label: "Node + macOS", stacks: "node,macos" },
  { label: "Python + macOS", stacks: "python,macos" },
  { label: "Rust + macOS", stacks: "rust,macos" },
  { label: "Go + macOS", stacks: "go,macos" },
  { label: "Swift + Xcode", stacks: "swift,xcode" },
];

async function fetchIgnore(stacks: string): Promise<string> {
  const cleaned = stacks
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .join(",");
  if (!cleaned) throw new Error("Provide at least one stack name.");
  const res = await fetch(`https://www.toptal.com/developers/gitignore/api/${encodeURIComponent(cleaned)}`);
  if (res.status === 404) {
    throw new Error("Unknown stack. Try the 'list' button to see all available stacks.");
  }
  if (!res.ok) throw new Error(`gitignore.io error ${res.status}`);
  return await res.text();
}

async function fetchList(): Promise<string[]> {
  const res = await fetch("https://www.toptal.com/developers/gitignore/api/list");
  if (!res.ok) throw new Error(`gitignore.io list error ${res.status}`);
  const text = await res.text();
  return text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

function MakeGitignore(props: Props) {
  const closeWidget = useCloseWidget();
  const [stacks, setStacks] = useState(props.stacks);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [showList, setShowList] = useState(false);
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setShowList(false);
    fetchIgnore(stacks)
      .then((t) => {
        if (cancelled) return;
        setOutput(t);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onGenerate() {
    setReloadCount((c) => c + 1);
  }

  function onPreset(s: string) {
    setStacks(s);
    setReloadCount((c) => c + 1);
  }

  async function onShowList() {
    if (available.length === 0) {
      try {
        const list = await fetchList();
        setAvailable(list);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    }
    setShowList(true);
  }

  function onDone() {
    if (status === "error") {
      closeWidget(`Error: ${errorMsg}`);
      return;
    }
    if (output) {
      closeWidget(output);
    } else {
      closeWidget("No content.");
    }
  }

  let markdown: string;
  if (showList) {
    const cols = 6;
    const rows: string[] = [];
    for (let i = 0; i < available.length; i += cols) {
      rows.push(available.slice(i, i + cols).map((s) => `\`${s}\``).join(" · "));
    }
    markdown = [
      `### Available stacks (${available.length})`,
      "",
      ...rows,
    ].join("\n");
  } else if (status === "loading") {
    markdown = "_Generating .gitignore…_";
  } else if (status === "error") {
    markdown = `**Error:** ${errorMsg}`;
  } else {
    const preview = output.length > 6000 ? output.slice(0, 6000) + "\n\n…(truncated for preview)" : output;
    markdown = [
      `### \`.gitignore\` for **${stacks}**`,
      "",
      "```gitignore",
      preview,
      "```",
      "",
      "_Source: gitignore.io (toptal.com/developers/gitignore)_",
    ].join("\n");
  }

  return (
    <Form
      header={<CardHeader title="Generate .gitignore" iconBundleId="com.apple.dt.Xcode" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Generate" onSubmit={onGenerate} style="primary" />
          {COMMON_PRESETS.map((p) => (
            <Action key={p.label} title={p.label} onAction={() => onPreset(p.stacks)} style="secondary" />
          ))}
          <Action title="List stacks" onAction={onShowList} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="stacks" label="Stacks (comma-separated)" value={stacks} onChange={setStacks} />
    </Form>
  );
}

const GitignoreWidget = defineWidget({
  name: "make_gitignore",
  description:
    "Generate a .gitignore for one or more development stacks via gitignore.io (free). Comma-separated stack list, e.g. 'node,macos,vscode'. 'List stacks' shows all available identifiers. Done returns the full file text so the LLM can write it to disk.",
  schema,
  component: MakeGitignore,
});

export default GitignoreWidget;
