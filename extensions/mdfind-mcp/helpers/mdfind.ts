// Spotlight (mdfind) wrapper. mdfind is the macOS-built-in Spotlight CLI.

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname } from "node:path";

export interface FoundFile {
  path: string;
  name: string;
  parent: string;
  size?: number;
  modifiedAt?: Date;
  kind?: string;
}

function runCmd(cmd: string, args: string[], timeoutMs = 8000): Promise<{ code: number; stdout: string; stderr: string }> {
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

export interface SearchOptions {
  query: string;
  scope?: "home" | "all" | string; // 'home' = ~, 'all' = no -onlyin, otherwise a path
  filenameMode: boolean; // true ⇒ -name (filename only); false ⇒ Spotlight content+metadata
  limit: number;
}

export async function spotlightSearch(opts: SearchOptions): Promise<FoundFile[]> {
  const { query, filenameMode } = opts;
  if (!query.trim()) return [];
  const args: string[] = [];
  if (filenameMode) args.push("-name");
  if (opts.scope && opts.scope !== "all") {
    const scope = opts.scope === "home" ? homedir() : opts.scope;
    args.push("-onlyin", scope);
  }
  args.push(query);
  const { code, stdout, stderr } = await runCmd("mdfind", args, 10000);
  if (code !== 0 && stderr.trim()) {
    throw new Error(stderr.trim());
  }
  const limit = Math.max(1, Math.min(500, opts.limit));
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, limit);

  // Stat each result so we can show size + mtime. Skip files we can't read.
  const results: FoundFile[] = [];
  await Promise.all(
    lines.map(async (path) => {
      const entry: FoundFile = { path, name: basename(path), parent: dirname(path) };
      try {
        const s = await stat(path);
        entry.size = s.size;
        entry.modifiedAt = s.mtime;
      } catch {
        /* ignore unreadable */
      }
      results.push(entry);
    }),
  );
  // Preserve mdfind's ordering (Spotlight relevance) by re-mapping.
  const order = new Map(lines.map((p, i) => [p, i]));
  results.sort((a, b) => (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0));
  return results;
}

export function fmtBytes(n: number | undefined): string {
  if (n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function shortPath(p: string): string {
  const home = homedir();
  if (p.startsWith(home)) return p.replace(home, "~");
  return p;
}
