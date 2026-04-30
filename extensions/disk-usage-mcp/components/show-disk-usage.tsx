import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { MountInfo, formatBytes, listMounts } from "../helpers/df.js";

const schema = z.object({});

type Props = z.infer<typeof schema>;

function bar(percent: number, width = 12): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function ShowDiskUsage(_props: Props) {
  const closeWidget = useCloseWidget();
  const [mounts, setMounts] = useState<MountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      setMounts(await listMounts());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onDone() {
    if (!mounts.length) closeWidget("No mounts found.");
    else {
      const root = mounts.find((m) => m.mountPoint === "/") ?? mounts[0];
      closeWidget(`${root.mountPoint}: ${formatBytes(root.availableKb)} free of ${formatBytes(root.totalKb)}.`);
    }
  }

  const header = <CardHeader title="Disk Usage" iconBundleId="com.apple.systempreferences" />;
  const actions = (
    <ActionPanel layout="row">
      <Action title="Refresh" onAction={load} style="secondary" />
      <Action title="Done" onAction={onDone} style="primary" />
    </ActionPanel>
  );

  if (isLoading) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Reading mounts..." />
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
  if (!mounts.length) {
    lines.push("_No mounted volumes found._");
  } else {
    for (const m of mounts) {
      lines.push(`### \`${m.mountPoint}\``);
      lines.push(`\`${bar(m.capacity)}\` **${m.capacity}%**`);
      lines.push(`${formatBytes(m.usedKb)} used of ${formatBytes(m.totalKb)} — ${formatBytes(m.availableKb)} free`);
      lines.push(`_${m.filesystem}_`);
      lines.push("");
    }
  }

  return (
    <Form header={header} actions={actions}>
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ShowDiskUsageWidget = defineWidget({
  name: "show-disk-usage",
  description: "Show free and used disk space for each mounted, non-virtual volume.",
  schema,
  component: ShowDiskUsage,
});

export default ShowDiskUsageWidget;
