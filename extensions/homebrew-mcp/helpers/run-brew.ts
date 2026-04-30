import { spawn } from "node:child_process";

const BREW_PATHS = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];

let cachedBrewPath: string | null = null;

async function which(cmd: string): Promise<string | null> {
  return await new Promise((resolve) => {
    const child = spawn("which", [cmd]);
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const path = stdout.trim();
      resolve(path || null);
    });
  });
}

async function resolveBrewPath(): Promise<string> {
  if (cachedBrewPath) return cachedBrewPath;
  for (const path of BREW_PATHS) {
    try {
      const { promises: fs } = await import("node:fs");
      await fs.access(path);
      cachedBrewPath = path;
      return path;
    } catch {
      // continue
    }
  }
  const fromWhich = await which("brew");
  if (fromWhich) {
    cachedBrewPath = fromWhich;
    return fromWhich;
  }
  throw new Error("Homebrew not found. Install it from https://brew.sh");
}

export async function runBrew(args: string[]): Promise<string> {
  const brewPath = await resolveBrewPath();
  return await new Promise((resolve, reject) => {
    const child = spawn(brewPath, args, { env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: "1" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `brew exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}
