import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".config", "eney-skills");
const CONFIG_PATH = join(CONFIG_DIR, "video-subtitles-mcp.json");

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface Config {
  youtubeClientId?: string;
  youtubeClientSecret?: string;
  youtubeTokens?: StoredTokens;
}

export async function loadConfig(): Promise<Config> {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

export async function saveConfig(patch: Partial<Config>): Promise<void> {
  const current = await loadConfig();
  const next = { ...current, ...patch };
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
}
