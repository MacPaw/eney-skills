import { runCommand } from "./run-script.js";

const SERVICE = "eney-mac-smart-organizer";
const ACCOUNT = "anthropic-api-key";

export async function loadApiKey(): Promise<string | null> {
  try {
    const out = await runCommand("security", [
      "find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w",
    ]);
    return out.trim() || null;
  } catch {
    return null;
  }
}

export async function saveApiKey(key: string): Promise<void> {
  await runCommand("security", [
    "add-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w", key, "-U",
  ]);
}

export async function deleteApiKey(): Promise<void> {
  try {
    await runCommand("security", ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]);
  } catch {
    // ignore — key may not exist
  }
}
