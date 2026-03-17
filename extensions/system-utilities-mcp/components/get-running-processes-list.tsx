import { useCallback, useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  defineWidget,
  Form,
  Paper,
  useCloseWidget,
} from "@eney/api";
import { spawn } from "node:child_process";

interface ProcessInfo {
  cpu: number;
  memoryMb: number;
  command: string;
}

function escapeMarkdown(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[|]/g, "\\$&");
}

function parseMemory(memStr: string): number {
  const match = memStr.match(/^([\d.]+)([KMGB])?/i);
  if (!match) return 0;

  const value = Number.parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  switch (unit) {
    case "K":
      return value / 1024;
    case "M":
      return value;
    case "G":
      return value * 1024;
    default:
      return value / (1024 * 1024);
  }
}

function formatProcesses(raw: string): ProcessInfo[] {
  const lines = raw.split("\n");

  const processStartIndex = lines.findIndex((line) => line.startsWith("PID"));
  if (processStartIndex === -1) return [];

  return lines
    .slice(processStartIndex + 1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // top output: PID CPU MEM COMMAND (command is last, can have spaces)
      const parts = line.split(/\s+/);
      if (parts.length < 4) return null;

      const [, cpuStr, memStr, ...commandParts] = parts;
      const cpu = Number.parseFloat(cpuStr);
      const memoryMb = parseMemory(memStr);
      const command = commandParts.join(" ");

      return {
        cpu: Number.isFinite(cpu) ? cpu : 0,
        memoryMb,
        command: command || "[unknown]",
      };
    })
    .filter((p): p is ProcessInfo => p !== null);
}

type SortBy = "cpu" | "mem";

async function fetchProcesses(sortBy: SortBy): Promise<ProcessInfo[]> {
  // -l 2: two samples (second is more accurate), -n 10: top 10 processes
  // -o: sort order, -stats: columns to show
  // tail -n 11: get header + 10 processes from second sample
  const cmd = spawn("sh", [
    "-c",
    `top -l 2 -n 10 -o ${sortBy} -stats pid,cpu,mem,command | tail -n 11`,
  ]);
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    cmd.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    cmd.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    cmd.on("error", (error) => {
      reject(error);
    });

    cmd.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `top exited with code ${code}`));
        return;
      }
      resolve(formatProcesses(stdout));
    });
  });
}

function GetRunningProcessesList() {
  const closeWidget = useCloseWidget();
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("cpu");

  const loadProcesses = useCallback(async (sort: SortBy) => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchProcesses(sort);
      setProcesses(list);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load running processes.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProcesses(sortBy);
  }, [loadProcesses, sortBy]);

  const handleSortChange = (newSort: SortBy) => {
    if (newSort !== sortBy) {
      setSortBy(newSort);
    }
  };

  const markdown = processes.length
    ? [
        "| CPU % | Memory (MB) | Process |",
        "| ---: | ---: | --- |",
        ...processes.map((process) => {
          const cpu = process.cpu.toFixed(1);
          const memory = process.memoryMb.toFixed(1);
          return `| ${cpu} | ${memory} | ${escapeMarkdown(process.command)} |`;
        }),
      ].join("\n")
    : "No running processes found.";

  function onDone() {
    if (error) {
      closeWidget(`Error: ${error}`);
    } else {
      closeWidget(`Successfully retrieved running processes list: ${markdown}`);
    }
  }

  const actions = (
    <ActionPanel layout="row">
      <Action
        title="Refresh"
        onAction={() => loadProcesses(sortBy)}
        style="secondary"
        isLoading={isLoading}
      />
      <Action.SubmitForm onSubmit={onDone} style="primary" title="Done" />
    </ActionPanel>
  );

  if (error) {
    return <Paper markdown={`**Error:** ${error}`} actions={actions} />;
  }

  return (
    <Form>
      <Form.Dropdown
        name="sortBy"
        label="Sort by"
        value={sortBy}
        onChange={(value) => handleSortChange(value as SortBy)}
      >
        <Form.Dropdown.Item title="CPU" value="cpu" />
        <Form.Dropdown.Item title="Memory" value="mem" />
      </Form.Dropdown>
      <Paper
        markdown={
          isLoading && !processes.length ? "Loading processes…" : markdown
        }
        actions={actions}
        isScrollable
      />
    </Form>
  );
}

const GetRunningProcessesListWidget = defineWidget({
  name: "get-running-processes-list",
  description: "Get a list of running processes",
  component: GetRunningProcessesList,
});

export default GetRunningProcessesListWidget;
