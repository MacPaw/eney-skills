import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { cpus, loadavg, uptime } from "node:os";

const schema = z.object({});

type Props = z.infer<typeof schema>;

interface Snapshot {
  uptimeSeconds: number;
  bootTime: Date;
  load: [number, number, number];
  cpuCount: number;
}

function snapshot(): Snapshot {
  const u = uptime();
  return {
    uptimeSeconds: u,
    bootTime: new Date(Date.now() - u * 1000),
    load: loadavg() as [number, number, number],
    cpuCount: cpus().length,
  };
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function loadIndicator(load1: number, cpus: number): string {
  if (cpus <= 0) return "";
  const ratio = load1 / cpus;
  if (ratio < 0.5) return "_idle_";
  if (ratio < 1) return "_busy_";
  if (ratio < 2) return "_saturated_";
  return "_overloaded_";
}

function ShowUptime(_props: Props) {
  const closeWidget = useCloseWidget();
  const [snap, setSnap] = useState<Snapshot>(() => snapshot());

  useEffect(() => {
    const id = setInterval(() => setSnap(snapshot()), 1000);
    return () => clearInterval(id);
  }, []);

  function onDone() {
    closeWidget(`Up ${formatDuration(snap.uptimeSeconds)}.`);
  }

  const lines = [
    `### Up for **${formatDuration(snap.uptimeSeconds)}**`,
    "",
    `Booted: \`${snap.bootTime.toLocaleString()}\``,
    "",
    "### Load average",
    "",
    "| Window | Load | |",
    "|---|---|---|",
    `| 1m | \`${snap.load[0].toFixed(2)}\` | ${loadIndicator(snap.load[0], snap.cpuCount)} |`,
    `| 5m | \`${snap.load[1].toFixed(2)}\` | |`,
    `| 15m | \`${snap.load[2].toFixed(2)}\` | |`,
    "",
    `_${snap.cpuCount} logical CPU(s) — load is "saturated" when the 1-minute average reaches your CPU count._`,
  ];

  return (
    <Form
      header={<CardHeader title="Uptime" iconBundleId="com.apple.systempreferences" />}
      actions={
        <ActionPanel>
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ShowUptimeWidget = defineWidget({
  name: "show-uptime",
  description:
    "Show how long this Mac has been running, when it last booted, and 1/5/15-minute load averages relative to CPU count. Updates every second.",
  schema,
  component: ShowUptime,
});

export default ShowUptimeWidget;
