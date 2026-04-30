import { createHash } from "node:crypto";

export interface PwnedResult {
  ok: true;
  count: number;
  fullHashPreview: string;
}

export interface PwnedError {
  ok: false;
  error: string;
}

export function sha1Upper(password: string): string {
  return createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
}

export async function checkPwned(password: string, signal?: AbortSignal): Promise<PwnedResult | PwnedError> {
  if (!password) return { ok: false, error: "Empty password." };
  const hash = sha1Upper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let body: string;
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal,
    });
    if (!res.ok) return { ok: false, error: `HIBP API returned ${res.status}` };
    body = await res.text();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  for (const line of body.split(/\r?\n/)) {
    const [lineSuffix, lineCount] = line.trim().split(":");
    if (!lineSuffix) continue;
    if (lineSuffix.toUpperCase() === suffix) {
      const count = Number.parseInt(lineCount ?? "0", 10);
      return {
        ok: true,
        count: Number.isFinite(count) ? count : 0,
        fullHashPreview: `${prefix}…${suffix.slice(-4)}`,
      };
    }
  }
  return { ok: true, count: 0, fullHashPreview: `${prefix}…${suffix.slice(-4)}` };
}
