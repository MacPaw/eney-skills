import { execFileSync } from "child_process";

const SERVICE = "decision-maker-mcp";
const ACCOUNT = "anthropic-api-key";

export function getApiKey(): string | null {
  try {
    const key = execFileSync("security", [
      "find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w",
    ]).toString().trim();
    return key || null;
  } catch {
    return null;
  }
}

export function saveApiKey(key: string): void {
  execFileSync("security", [
    "add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-w", key,
  ]);
}
