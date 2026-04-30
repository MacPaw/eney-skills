import { spawn } from "node:child_process";

export interface MountInfo {
  filesystem: string;
  totalKb: number;
  usedKb: number;
  availableKb: number;
  capacity: number;
  mountPoint: string;
}

async function run(cmd: string, args: string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

const SKIP_PREFIXES = ["devfs", "map ", "/dev/disk0", "tmpfs"];

export async function listMounts(): Promise<MountInfo[]> {
  const stdout = await run("df", ["-kP"]);
  const [, ...lines] = stdout.split("\n");
  const mounts: MountInfo[] = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 6) continue;
    const filesystem = parts[0];
    const totalKb = Number.parseInt(parts[1], 10);
    const usedKb = Number.parseInt(parts[2], 10);
    const availableKb = Number.parseInt(parts[3], 10);
    const capacity = Number.parseInt(parts[4], 10);
    const mountPoint = parts.slice(5).join(" ");
    if (SKIP_PREFIXES.some((p) => filesystem.startsWith(p))) continue;
    if (!Number.isFinite(totalKb) || totalKb === 0) continue;
    mounts.push({ filesystem, totalKb, usedKb, availableKb, capacity, mountPoint });
  }
  return mounts;
}

export function formatBytes(kb: number): string {
  const bytes = kb * 1024;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}
