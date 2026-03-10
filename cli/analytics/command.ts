import { writeFile } from "fs/promises";
import { CloudflareAnalyticsClient } from "./cf-analytics.ts";

type AnalyticsOptions = {
  sort: string;
  limit: string;
  mode: string;
  days: string;
  output?: string;
};

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

export async function analyticsCommand(options: AnalyticsOptions) {
  const limit = parseInt(options.limit, 10);
  if (isNaN(limit) || limit <= 0) {
    console.error("Error: --limit must be a positive number");
    process.exit(1);
  }

  const days = parseInt(options.days, 10);
  if (isNaN(days) || days <= 0) {
    console.error("Error: --days must be a positive number");
    process.exit(1);
  }

  if (options.sort !== "most" && options.sort !== "least") {
    console.error("Error: --sort must be either 'most' or 'least'");
    process.exit(1);
  }

  if (options.mode !== "staging" && options.mode !== "production") {
    console.error("Error: --mode must be either 'staging' or 'production'");
    process.exit(1);
  }

  const sort = options.sort as "most" | "least";
  const mode = options.mode as "staging" | "production";

  const host = CloudflareAnalyticsClient.getHostForMode(mode);
  console.log(`Fetching analytics for ${host}...`);

  try {
    const client = new CloudflareAnalyticsClient();
    const result = await client.getRequestsByPath(host, sort, limit, days);

    console.log("Done.");

    console.log();
    console.log(`Total requests: ${formatNumber(result.totalRequests)}`);
    console.log(`Period: ${result.period.start} to ${result.period.end}`);
    console.log(`Showing ${sort === "most" ? "top" : "bottom"} ${result.paths.length} paths:`);

    console.table(result.paths);

    if (options.output) {
      await writeFile(options.output, JSON.stringify(result, null, 2));
      console.log(`Results saved to: ${options.output}`);
    }

    console.log("Done!");
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
