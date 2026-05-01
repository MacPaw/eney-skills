// Process listing + termination helpers using `ps` and `kill`.
// We deliberately avoid `pgrep -k`-style mass kills; the user always
// terminates a single PID through the widget after seeing the list.

import { spawn } from "node:child_process";

export interface ProcessRow {
  pid: number;
  cpu: number; // percent
  mem: number; // percent
  rss: number; // KB
  command: string;
  user: string;
}

export type SortBy = "cpu" | "mem";

function runCmd(cmd: string, args: string[], timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = "";
    let err = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);
    proc.stdout?.on("data", (d) => {
      out += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(t);
      if (killed) return reject(new Error("Timed out"));
      if (code !== 0) return reject(new Error(err.trim() || `Exit code ${code}`));
      resolve(out);
    });
  });
}

export async function listProcesses(sortBy: SortBy, limit: number): Promise<ProcessRow[]> {
  const sortFlag = sortBy === "cpu" ? "-pcpu" : "-rss";
  const stdout = await runCmd("ps", [
    "-Aro",
    `pid,user,pcpu,pmem,rss,comm`,
    sortFlag,
  ]);
  const lines = stdout.split("\n").slice(1).filter((l) => l.trim());
  const rows: ProcessRow[] = [];
  for (const line of lines) {
    const m = line.trim().match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(.+)$/);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    rows.push({
      pid,
      user: m[2],
      cpu: parseFloat(m[3]) || 0,
      mem: parseFloat(m[4]) || 0,
      rss: parseInt(m[5], 10) || 0,
      command: m[6],
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export async function killPid(pid: number, signal: "TERM" | "KILL" = "TERM"): Promise<void> {
  if (!Number.isInteger(pid) || pid <= 1) {
    throw new Error("Invalid PID.");
  }
  await runCmd("kill", [`-${signal}`, String(pid)]);
}

export function fmtBytes(kb: number): string {
  if (kb < 1024) return `${kb.toLocaleString()} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(2)} GB`;
}
