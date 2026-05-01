// Wrapper around `brew services` for listing and controlling Homebrew services.
// We invoke the brew binary directly so the widget doesn't depend on PATH.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export type ServiceState = "started" | "stopped" | "scheduled" | "error" | "unknown" | "none";

export interface BrewService {
  name: string;
  state: ServiceState;
  user: string;
  file: string;
}

const CANDIDATE_BREW_PATHS = [
  "/opt/homebrew/bin/brew", // Apple Silicon default
  "/usr/local/bin/brew", // Intel default
  "/home/linuxbrew/.linuxbrew/bin/brew", // Linuxbrew (just in case)
];

export function findBrew(): string | null {
  for (const p of CANDIDATE_BREW_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

function runCmd(cmd: string, args: string[], timeoutMs = 15_000): Promise<{ code: number; stdout: string; stderr: string }> {
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

function parseListLine(line: string): BrewService | null {
  // brew services list columns: Name | Status | User | File
  const m = line.match(/^(\S+)\s+(\S+)\s+(\S*)\s*(.*)$/);
  if (!m) return null;
  const stateRaw = m[2].toLowerCase();
  const state: ServiceState =
    stateRaw === "started"
      ? "started"
      : stateRaw === "stopped"
        ? "stopped"
        : stateRaw === "scheduled"
          ? "scheduled"
          : stateRaw === "error"
            ? "error"
            : stateRaw === "none"
              ? "none"
              : "unknown";
  return {
    name: m[1],
    state,
    user: m[3] ?? "",
    file: m[4] ?? "",
  };
}

export async function listServices(): Promise<BrewService[]> {
  const brew = findBrew();
  if (!brew) throw new Error("Homebrew not found at the standard locations.");
  const { code, stdout, stderr } = await runCmd(brew, ["services", "list"]);
  if (code !== 0) {
    throw new Error(stderr.trim() || `brew services list failed (exit ${code})`);
  }
  // First line is the header; skip it.
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const data = lines.slice(1); // drop header
  return data.map(parseListLine).filter((s): s is BrewService => s !== null);
}

export type Action = "start" | "stop" | "restart" | "run";

export async function controlService(name: string, action: Action): Promise<string> {
  const brew = findBrew();
  if (!brew) throw new Error("Homebrew not found.");
  if (!/^[a-zA-Z0-9._@+-]+$/.test(name)) {
    throw new Error(`Refusing to use suspicious service name: "${name}".`);
  }
  const { code, stdout, stderr } = await runCmd(brew, ["services", action, name], 30_000);
  if (code !== 0) {
    throw new Error(stderr.trim() || `brew services ${action} ${name} failed (exit ${code})`);
  }
  return stdout.trim() || stderr.trim();
}
