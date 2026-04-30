import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

export interface LocalAddress {
  iface: string;
  family: "IPv4" | "IPv6";
  address: string;
}

export function getLocalAddresses(): LocalAddress[] {
  const interfaces = networkInterfaces();
  const result: LocalAddress[] = [];
  for (const [iface, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.internal) continue;
      if (addr.family === "IPv4" || addr.family === "IPv6") {
        result.push({ iface, family: addr.family, address: addr.address });
      }
    }
  }
  return result;
}

async function runCommand(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", () => resolve({ ok: false, stdout, stderr }));
    child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr: stderr.trim() }));
  });
}

export async function getWifiSSID(): Promise<string | null> {
  for (const iface of ["en0", "en1"]) {
    const { ok, stdout } = await runCommand("networksetup", ["-getairportnetwork", iface]);
    if (!ok) continue;
    const line = stdout.trim();
    const match = line.match(/Current Wi-Fi Network:\s*(.+)$/);
    if (match) return match[1].trim();
    if (/not associated/i.test(line)) return null;
  }
  return null;
}

export async function getPublicIP(signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=text", { signal });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text || null;
  } catch {
    return null;
  }
}
