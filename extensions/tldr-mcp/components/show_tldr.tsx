import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const PLATFORMS = ["common", "linux", "osx", "windows", "android", "freebsd", "netbsd", "openbsd", "sunos"] as const;

const schema = z.object({
  command: z.string().describe("Command to look up, e.g. 'curl', 'git commit', 'tar'."),
  platform: z
    .enum(PLATFORMS)
    .optional()
    .describe("Platform-specific page to prefer. Falls back to 'common' if missing. Defaults to 'osx' on macOS."),
});

type Props = z.infer<typeof schema>;

function slug(command: string): string {
  return command.trim().toLowerCase().replace(/\s+/g, "-");
}

async function fetchPage(command: string, platform: string): Promise<{ md: string; platform: string }> {
  const s = slug(command);
  const order = [platform, "common", ...PLATFORMS.filter((p) => p !== platform && p !== "common")];
  for (const p of order) {
    const url = `https://raw.githubusercontent.com/tldr-pages/tldr/main/pages/${p}/${encodeURIComponent(s)}.md`;
    const res = await fetch(url);
    if (res.ok) {
      return { md: await res.text(), platform: p };
    }
  }
  throw new Error(`No tldr page found for "${command}".`);
}

function Tldr(props: Props) {
  const closeWidget = useCloseWidget();
  const [command, setCommand] = useState(props.command);
  const [platform, setPlatform] = useState<NonNullable<Props["platform"]>>(props.platform ?? "osx");
  const [page, setPage] = useState<{ md: string; platform: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchPage(command, platform)
      .then((p) => {
        if (cancelled) return;
        setPage(p);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onSetPlatform(p: NonNullable<Props["platform"]>) {
    setPlatform(p);
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (page) {
      closeWidget(`tldr ${command} (${page.platform}):\n\n${page.md}`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Loading…_ 📖"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : page
          ? `_Source: tldr-pages (${page.platform}) · CC BY 4.0_\n\n${page.md}`
          : "";

  return (
    <Form
      header={<CardHeader title={`TLDR · ${command}`} iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="osx" onAction={() => onSetPlatform("osx")} style="secondary" />
          <Action title="linux" onAction={() => onSetPlatform("linux")} style="secondary" />
          <Action title="common" onAction={() => onSetPlatform("common")} style="secondary" />
          <Action title="windows" onAction={() => onSetPlatform("windows")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="command" label="Command" value={command} onChange={setCommand} />
    </Form>
  );
}

const TldrWidget = defineWidget({
  name: "show_tldr",
  description:
    "Show a simplified, example-driven cheatsheet for a CLI command, sourced from the tldr-pages project (CC BY 4.0). Tries the requested platform first, then falls back to 'common'. Use 'platform' to pick osx/linux/windows/android/etc.",
  schema,
  component: Tldr,
});

export default TldrWidget;
