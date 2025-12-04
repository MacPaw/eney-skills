import { writeFile } from "fs/promises";
import { CloudflareAnalyticsClient } from "./cf-analytics.ts";

type AnalyticsOptions = {
	sort: "most" | "least";
	limit: string;
	host: string;
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

	console.log(`\nFetching Cloudflare analytics for ${options.host}...`);
	console.log(`Period: Last 7 days`);
	console.log(`Sort: ${options.sort === "most" ? "Most" : "Least"} requests first\n`);

	try {
		const client = new CloudflareAnalyticsClient();
		const result = await client.getRequestsByPath(options.host, options.sort, limit);

		console.log(`Total requests: ${formatNumber(result.totalRequests)}`);
		console.log(`Period: ${result.period.start} to ${result.period.end}`);
		console.log(`Showing top ${result.paths.length} paths:\n`);

		console.table(result.paths);

		if (options.output) {
			await writeFile(options.output, JSON.stringify(result, null, 2));
			console.log(`\nResults saved to: ${options.output}`);
		}
	} catch (error) {
		console.error(`\nError: ${error instanceof Error ? error.message : error}`);
		process.exit(1);
	}
}
