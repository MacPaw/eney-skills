import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CronNextRunsWidget from "./components/cron_next_runs.js";

const server = new McpServer(
  { name: "cron-next-runs-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CronNextRunsWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Cron Next Runs MCP Server running on stdio");
}

main().catch(console.error);
