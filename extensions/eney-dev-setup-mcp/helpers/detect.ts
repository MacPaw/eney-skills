import { existsSync } from "node:fs";
import { run, tryRun } from "./shell.js";

export type ToolId = "brew" | "git" | "node";

export interface ToolStatus {
  id: ToolId;
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  manager: string | null;
  note: string | null;
}

const BREW_PATHS = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];

export async function findBrewPath(): Promise<string | null> {
  const which = await tryRun("/bin/sh", ["-lc", "command -v brew"]);
  if (which && which.code === 0 && which.stdout) return which.stdout;
  for (const p of BREW_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function getVersion(bin: string, arg = "--version"): Promise<string | null> {
  const result = await tryRun(bin, [arg]);
  if (!result || result.code !== 0) return null;
  const firstLine = result.stdout.split("\n")[0]?.trim() ?? "";
  return firstLine || null;
}

async function which(cmd: string): Promise<string | null> {
  const result = await tryRun("/bin/sh", ["-lc", `command -v ${cmd}`]);
  if (result && result.code === 0 && result.stdout) return result.stdout;
  return null;
}

async function detectNodeManager(nodePath: string): Promise<string | null> {
  if (nodePath.includes("/.nvm/")) return "nvm";
  if (nodePath.includes("/fnm/") || nodePath.includes("/.fnm/")) return "fnm";
  if (nodePath.startsWith("/opt/homebrew/") || nodePath.startsWith("/usr/local/Cellar/")) return "brew";
  return null;
}

export async function detectBrew(): Promise<ToolStatus> {
  const path = await findBrewPath();
  if (!path) {
    return { id: "brew", name: "Homebrew", installed: false, version: null, path: null, manager: null, note: null };
  }
  const version = await getVersion(path);
  const onPath = (await which("brew")) !== null;
  return {
    id: "brew",
    name: "Homebrew",
    installed: true,
    version,
    path,
    manager: null,
    note: onPath ? null : `Installed at ${path} but not on PATH. Add it to your shell profile.`,
  };
}

export async function detectGit(): Promise<ToolStatus> {
  const path = await which("git");
  if (!path) {
    const xcodeSelect = await tryRun("/usr/bin/xcode-select", ["-p"]);
    const cltMissing = !xcodeSelect || xcodeSelect.code !== 0;
    return {
      id: "git",
      name: "Git",
      installed: false,
      version: null,
      path: null,
      manager: null,
      note: cltMissing ? "Xcode Command Line Tools are not installed." : null,
    };
  }
  const versionResult = await tryRun(path, ["--version"]);
  const version = versionResult?.stdout?.trim() ?? null;
  const manager = path.startsWith("/opt/homebrew/") || path.startsWith("/usr/local/Cellar/") ? "brew" : "system";
  return { id: "git", name: "Git", installed: true, version, path, manager, note: null };
}

export async function detectNode(): Promise<ToolStatus> {
  const path = await which("node");
  if (!path) {
    return { id: "node", name: "Node.js", installed: false, version: null, path: null, manager: null, note: null };
  }
  const version = await getVersion(path);
  const manager = await detectNodeManager(path);
  return {
    id: "node",
    name: "Node.js",
    installed: true,
    version,
    path,
    manager,
    note: manager && manager !== "brew" ? `Managed by ${manager}. Leave as-is.` : null,
  };
}

export async function detectAll(): Promise<Record<ToolId, ToolStatus>> {
  const [brew, git, node] = await Promise.all([detectBrew(), detectGit(), detectNode()]);
  return { brew, git, node };
}

export async function installGit(onOutput: (chunk: string) => void): Promise<void> {
  const brew = await findBrewPath();
  if (!brew) throw new Error("Homebrew is required to install Git. Install Homebrew first.");
  const result = await run(brew, ["install", "git"], {}, (chunk) => onOutput(chunk));
  if (result.code !== 0) throw new Error(result.stderr || `brew install git exited with code ${result.code}`);
}

export async function installNode(onOutput: (chunk: string) => void): Promise<void> {
  const brew = await findBrewPath();
  if (!brew) throw new Error("Homebrew is required to install Node.js. Install Homebrew first.");
  const result = await run(brew, ["install", "node"], {}, (chunk) => onOutput(chunk));
  if (result.code !== 0) throw new Error(result.stderr || `brew install node exited with code ${result.code}`);
}

export async function requestXcodeCLT(): Promise<void> {
  await tryRun("/usr/bin/xcode-select", ["--install"]);
}

export const BREW_INSTALL_COMMAND =
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

export async function installBrew(): Promise<void> {
  // Homebrew's installer is interactive (requires sudo password), so we open a
  // Terminal window with the command already running rather than spawning silently.
  const escapedCmd = BREW_INSTALL_COMMAND.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = [
    'tell application "Terminal"',
    "  activate",
    `  do script "${escapedCmd}"`,
    "end tell",
  ].join("\n");
  const result = await tryRun("osascript", ["-e", script]);
  if (!result || result.code !== 0) {
    throw new Error(result?.stderr || "Failed to open Terminal for Homebrew installation");
  }
}
