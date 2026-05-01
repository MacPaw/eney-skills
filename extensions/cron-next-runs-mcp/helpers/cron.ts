// Cron schedule preview using the cron-parser package.
// We import via createRequire because cron-parser ships CJS only and
// TypeScript's module=Node16 strict ESM resolution otherwise complains.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cronParser = require("cron-parser") as {
  parseExpression: (
    expression: string,
    options?: { tz?: string; currentDate?: Date | string },
  ) => {
    next(): { toDate(): Date };
  };
};

export interface NextRun {
  iso: string;
  display: string;
}

export interface NextRunsResult {
  expression: string;
  count: number;
  timezone: string;
  runs: NextRun[];
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatRun(d: Date, timezone?: string): { iso: string; display: string } {
  const iso = d.toISOString();
  if (timezone) {
    // Use Intl to render in the requested zone
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return { iso, display: `${fmt.format(d)} (${timezone})` };
  }
  // Default: UTC display
  const wd = WEEKDAY[d.getUTCDay()];
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return { iso, display: `${wd}, ${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC` };
}

export function nextRuns(
  expression: string,
  count: number,
  timezone?: string,
): NextRunsResult {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error("Cron expression is required.");
  const safeCount = Math.max(1, Math.min(50, Math.floor(count)));
  let iter;
  try {
    iter = cronParser.parseExpression(trimmed, timezone ? { tz: timezone } : undefined);
  } catch (err) {
    throw new Error(`Invalid cron expression: ${err instanceof Error ? err.message : String(err)}`);
  }
  const runs: NextRun[] = [];
  for (let i = 0; i < safeCount; i++) {
    const next = iter.next().toDate();
    runs.push(formatRun(next, timezone));
  }
  return {
    expression: trimmed,
    count: safeCount,
    timezone: timezone ?? "UTC",
    runs,
  };
}
