import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { listProcesses, killPid, fmtBytes, type ProcessRow, type SortBy } from "../helpers/processes.js";

const schema = z.object({
  sortBy: z.enum(["cpu", "mem"]).optional().describe("Sort the list by CPU or memory. Defaults to 'cpu'."),
  limit: z.number().int().optional().describe("How many top rows to show. Defaults to 15. Max 50."),
  pid: z.number().int().optional().describe("Optional PID to highlight in the list and pre-fill in the Kill PID field."),
});

type Props = z.infer<typeof schema>;

interface State {
  rows: ProcessRow[];
  status: "loading" | "done" | "error";
  errorMsg: string;
}

function bar(value: number, max: number, width = 12): string {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const blocks = Math.round(pct * width);
  return "█".repeat(blocks) + "░".repeat(width - blocks);
}

function buildMarkdown(state: State, sortBy: SortBy, killedMsg: string, highlightPid?: number): string {
  if (state.status === "loading") return "_Listing processes…_";
  if (state.status === "error") return `**Error:** ${state.errorMsg}`;
  if (state.rows.length === 0) return "_No processes._";
  const max = sortBy === "cpu" ? Math.max(...state.rows.map((r) => r.cpu), 1) : Math.max(...state.rows.map((r) => r.rss), 1);
  const lines: string[] = [];
  lines.push(`### Top ${state.rows.length} by ${sortBy === "cpu" ? "CPU" : "RAM"}`);
  if (killedMsg) {
    lines.push("");
    lines.push(`> ${killedMsg}`);
  }
  lines.push("");
  lines.push("| PID | CPU | RAM | Command |");
  lines.push("|---:|---:|---:|---|");
  for (const r of state.rows) {
    const value = sortBy === "cpu" ? r.cpu : r.rss;
    const meter = bar(value, max);
    const star = r.pid === highlightPid ? "⭐ " : "";
    lines.push(
      `| \`${r.pid}\` | ${r.cpu.toFixed(1)}% | ${fmtBytes(r.rss)} ${meter} | ${star}${r.command} |`,
    );
  }
  return lines.join("\n");
}

function KillProcess(props: Props) {
  const closeWidget = useCloseWidget();
  const [sortBy, setSortBy] = useState<SortBy>(props.sortBy ?? "cpu");
  const limit = Math.max(1, Math.min(50, props.limit ?? 15));
  const [pidToKill, setPidToKill] = useState<number>(props.pid ?? 0);
  const [state, setState] = useState<State>({ rows: [], status: "loading", errorMsg: "" });
  const [reloadCount, setReloadCount] = useState(0);
  const [killedMsg, setKilledMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    listProcesses(sortBy, limit)
      .then((rows) => {
        if (cancelled) return;
        setState({ rows, status: "done", errorMsg: "" });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ rows: [], status: "error", errorMsg: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
  }, [reloadCount, sortBy]);

  function onRefresh() {
    setKilledMsg("");
    setReloadCount((c) => c + 1);
  }

  function onSetSort(s: SortBy) {
    setSortBy(s);
  }

  async function onKill(signal: "TERM" | "KILL") {
    const pid = Math.floor(Number(pidToKill) || 0);
    if (pid <= 1) {
      setKilledMsg("⚠️ Enter a valid PID first.");
      return;
    }
    const target = state.rows.find((r) => r.pid === pid);
    const label = target ? `${target.command} (pid ${pid})` : `pid ${pid}`;
    try {
      await killPid(pid, signal);
      setKilledMsg(`✅ Sent SIG${signal} to ${label}.`);
      setReloadCount((c) => c + 1);
    } catch (err) {
      setKilledMsg(`❌ Failed to kill ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function onDone() {
    if (state.rows.length === 0) {
      closeWidget(state.errorMsg ? `Error: ${state.errorMsg}` : "Closed.");
      return;
    }
    const summary = state.rows
      .slice(0, 10)
      .map((r) => `${r.pid} ${r.command} — ${r.cpu.toFixed(1)}% CPU / ${fmtBytes(r.rss)}`)
      .join("\n");
    closeWidget(
      `${killedMsg ? killedMsg + "\n" : ""}Top ${Math.min(10, state.rows.length)} by ${sortBy === "cpu" ? "CPU" : "RAM"}:\n${summary}`,
    );
  }

  return (
    <Form
      header={<CardHeader title={`Processes (${sortBy === "cpu" ? "CPU" : "RAM"})`} iconBundleId="com.apple.ActivityMonitor" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={onRefresh} style="primary" />
          <Action title="Sort by CPU" onAction={() => onSetSort("cpu")} style="secondary" />
          <Action title="Sort by RAM" onAction={() => onSetSort("mem")} style="secondary" />
          <Action title="Send SIGTERM" onAction={() => onKill("TERM")} style="secondary" />
          <Action title="Send SIGKILL" onAction={() => onKill("KILL")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(state, sortBy, killedMsg, props.pid)} />
      <Form.NumberField
        name="pid"
        label="PID to kill"
        value={pidToKill}
        onChange={(v) => setPidToKill(Math.max(0, Math.floor(Number(v) || 0)))}
      />
    </Form>
  );
}

const KillProcessWidget = defineWidget({
  name: "kill_process",
  description:
    "List the top macOS processes by CPU or RAM and terminate one by PID. Uses /bin/ps for the listing and /bin/kill for termination. SIGTERM is the default; SIGKILL is available for stuck processes.",
  schema,
  component: KillProcess,
});

export default KillProcessWidget;
