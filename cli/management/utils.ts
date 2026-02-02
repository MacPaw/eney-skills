import color from "picocolors";
import { CloudflareAnalyticsClient } from "../analytics/cf-analytics.ts";

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatAge(date: Date | null): string {
  if (!date) return color.dim("unknown");

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let text: string;
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      text = `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
    } else {
      text = `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    }
  } else if (diffDays === 1) {
    text = "1 day ago";
  } else if (diffDays < 7) {
    text = `${diffDays} days ago`;
  } else if (diffDays < 14) {
    text = "1 week ago";
  } else {
    const diffWeeks = Math.floor(diffDays / 7);
    text = `${diffWeeks} weeks ago`;
  }

  if (diffDays <= 2) {
    return color.green(text);
  } else if (diffDays <= 7) {
    return color.yellow(text);
  } else {
    return color.red(text);
  }
}

export async function fetchAnalytics(mode: "staging" | "production"): Promise<Map<string, number>> {
  try {
    const cfClient = new CloudflareAnalyticsClient();
    return await cfClient.getExtensionDownloads(mode);
  } catch (error) {
    console.warn(
      `Warning: failed to fetch Cloudflare analytics in ${mode} mode. ` +
        `Download counts will be unavailable. Underlying error:`,
      error,
    );
    return new Map();
  }
}
