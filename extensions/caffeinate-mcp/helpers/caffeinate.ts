// caffeinate(8) wrapper. We spawn a detached child so it survives
// widget unmount and the MCP request lifecycle, then use pgrep/pkill
// to query and clean up running instances.

import { spawn } from "node:child_process";

export type CaffeinateMode = "display" | "system" | "system+display";

function flags(mode: CaffeinateMode): string[] {
  // -d: prevent display sleep
  // -i: prevent idle sleep
  // -m: prevent disk idle sleep (system)
  // We always include -i so the system stays awake
  if (mode === "display") return ["-di"];
  if (mode === "system") return ["-im"];
  return ["-dim"]; // system + display
}

function runCmd(cmd: string, args: string[], timeoutMs = 4000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);
    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(t);
      if (killed) return reject(new Error("Timed out"));
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export async function listRunning(): Promise<number[]> {
  // pgrep returns exit code 1 when no matches; treat as empty list
  const { code, stdout } = await runCmd("pgrep", ["-x", "caffeinate"]);
  if (code === 1) return [];
  if (code !== 0) throw new Error("pgrep caffeinate failed");
  return stdout
    .trim()
    .split(/\s+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export interface StartedRun {
  pid: number;
  durationSec: number;
  mode: CaffeinateMode;
}

export function startBackground(durationSec: number, mode: CaffeinateMode): StartedRun {
  const safe = Math.max(0, Math.floor(durationSec));
  const args = flags(mode);
  if (safe > 0) args.push("-t", String(safe));
  const proc = spawn("/usr/bin/caffeinate", args, {
    detached: true,
    stdio: "ignore",
  });
  // Detach so the child survives this MCP request
  proc.unref();
  if (!proc.pid) {
    throw new Error("Failed to spawn caffeinate.");
  }
  return { pid: proc.pid, durationSec: safe, mode };
}

export async function stopAll(): Promise<number> {
  // pkill returns 1 if there were no matches — that's fine
  const { code } = await runCmd("pkill", ["-x", "caffeinate"]);
  if (code !== 0 && code !== 1) {
    throw new Error("pkill failed");
  }
  // Wait briefly and recount
  await new Promise((r) => setTimeout(r, 100));
  const remaining = await listRunning();
  return remaining.length;
}

export function fmtDuration(sec: number): string {
  if (sec <= 0) return "indefinite";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  if (m > 0) return `${m}m${s > 0 ? ` ${s}s` : ""}`;
  return `${s}s`;
}
