import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { runBrew } from "../helpers/run-brew.js";

const schema = z.object({});

type Props = z.infer<typeof schema>;

interface InstalledPackage {
  name: string;
  versions: string[];
}

function parseListVersions(output: string): InstalledPackage[] {
  const packages: InstalledPackage[] = [];
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [name, ...versions] = line.split(/\s+/);
    if (name) packages.push({ name, versions });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

function ListInstalled(_props: Props) {
  const closeWidget = useCloseWidget();
  const [formulae, setFormulae] = useState<InstalledPackage[]>([]);
  const [casks, setCasks] = useState<InstalledPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      runBrew(["list", "--formula", "--versions"]).then(parseListVersions),
      runBrew(["list", "--cask", "--versions"]).then(parseListVersions).catch(() => [] as InstalledPackage[]),
    ])
      .then(([f, c]) => {
        setFormulae(f);
        setCasks(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoading(false));
  }, []);

  function onDone() {
    closeWidget(`${formulae.length} formula(e), ${casks.length} cask(s) installed.`);
  }

  const header = <CardHeader title="Installed Homebrew packages" iconBundleId="com.apple.Terminal" />;
  const actions = (
    <ActionPanel>
      <Action title="Done" onAction={onDone} style="primary" />
    </ActionPanel>
  );

  if (isLoading) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Loading installed packages..." />
      </Form>
    );
  }

  if (error) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown={`**Error:** ${error}`} />
      </Form>
    );
  }

  const lines: string[] = [];
  lines.push(`### Formulae (${formulae.length})`);
  if (formulae.length) {
    lines.push(...formulae.map((p) => `- \`${p.name}\` ${p.versions.join(", ")}`.trimEnd()));
  } else {
    lines.push("_None installed._");
  }
  lines.push("");
  lines.push(`### Casks (${casks.length})`);
  if (casks.length) {
    lines.push(...casks.map((p) => `- \`${p.name}\` ${p.versions.join(", ")}`.trimEnd()));
  } else {
    lines.push("_None installed._");
  }

  return (
    <Form header={header} actions={actions}>
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ListInstalledWidget = defineWidget({
  name: "list-installed",
  description: "List all Homebrew formulae and casks installed on this Mac, including versions.",
  schema,
  component: ListInstalled,
});

export default ListInstalledWidget;
