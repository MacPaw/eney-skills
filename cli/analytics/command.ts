import { writeFile } from "fs/promises";
import * as p from "@clack/prompts";
import { CloudflareAnalyticsClient } from "./cf-analytics.ts";

type AnalyticsOptions = {
  sort?: "most" | "least";
  limit?: string;
  host?: string;
  days?: string;
  output?: string;
};

type ResolvedOptions = {
  sort: "most" | "least";
  limit: number;
  host: string;
  days: number;
  output?: string;
};

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function checkAllRequiredOptions(options: AnalyticsOptions): boolean {
  return (
    options.sort !== undefined &&
    options.limit !== undefined &&
    options.host !== undefined &&
    options.days !== undefined
  );
}

async function promptForOptions(options: AnalyticsOptions): Promise<ResolvedOptions> {
  p.intro("Cloudflare Analytics");

  const answers = await p.group(
    {
      host: () =>
        options.host
          ? Promise.resolve(options.host)
          : p.select({
              message: "Select the host to analyze:",
              options: [
                { value: "cdn.eney.ai", label: "Production (cdn.eney.ai)" },
                { value: "staging-cdn.eney.ai", label: "Staging (staging-cdn.eney.ai)" },
              ],
            }),
      sort: () =>
        options.sort
          ? Promise.resolve(options.sort)
          : p.select({
              message: "Sort results by:",
              options: [
                { value: "most", label: "Most requests first" },
                { value: "least", label: "Least requests first" },
              ],
            }),
      limit: () =>
        options.limit
          ? Promise.resolve(options.limit)
          : p.text({
              message: "Number of results to show:",
              placeholder: "50",
              initialValue: "50",
              validate: (value) => {
                const num = parseInt(value, 10);
                if (isNaN(num) || num <= 0) return "Please enter a positive number";
              },
            }),
      days: () =>
        options.days
          ? Promise.resolve(options.days)
          : p.select({
              message: "Time period to analyze:",
              options: [
                { value: "1", label: "Last 24 hours" },
                { value: "7", label: "Last 7 days" },
                { value: "14", label: "Last 14 days" },
                { value: "30", label: "Last 30 days" },
              ],
            }),
      output: () =>
        options.output
          ? Promise.resolve(options.output)
          : p.text({
              message: "Output file path (optional):",
              placeholder: "Leave empty to skip",
            }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  return {
    host: answers.host as string,
    sort: answers.sort as "most" | "least",
    limit: parseInt(answers.limit as string, 10),
    days: parseInt(answers.days as string, 10),
    output: answers.output || undefined,
  };
}

async function runAnalytics(resolved: ResolvedOptions): Promise<void> {
  const spinner = p.spinner();
  spinner.start(`Fetching analytics for ${resolved.host}...`);

  try {
    const client = new CloudflareAnalyticsClient();
    const result = await client.getRequestsByPath(resolved.host, resolved.sort, resolved.limit, resolved.days);

    spinner.stop("Analytics fetched successfully");

    console.log();
    console.log(`Total requests: ${formatNumber(result.totalRequests)}`);
    console.log(`Period: ${result.period.start} to ${result.period.end}`);
    console.log(`Showing ${resolved.sort === "most" ? "top" : "bottom"} ${result.paths.length} paths:`);

    console.table(result.paths);

    if (resolved.output) {
      await writeFile(resolved.output, JSON.stringify(result, null, 2));
      p.note(`Results saved to: ${resolved.output}`);
    }

    p.outro("Done!");
  } catch (error) {
    spinner.stop("Failed to fetch analytics");
    p.cancel(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function analyticsCommand(options: AnalyticsOptions) {
  const hasAllRequiredOptions = checkAllRequiredOptions(options);

  if (!hasAllRequiredOptions) {
    const resolved = await promptForOptions(options);
    await runAnalytics(resolved);
  } else {
    const limit = parseInt(options.limit!, 10);
    if (isNaN(limit) || limit <= 0) {
      console.error("Error: --limit must be a positive number");
      process.exit(1);
    }

    const days = parseInt(options.days!, 10);
    if (isNaN(days) || days <= 0) {
      console.error("Error: --days must be a positive number");
      process.exit(1);
    }

    if (options.sort !== "most" && options.sort !== "least") {
      console.error("Error: --sort must be either 'most' or 'least'");
      process.exit(1);
    }

    await runAnalytics({
      limit,
      days,
      sort: options.sort,
      host: options.host!,
      output: options.output,
    });
  }
}
