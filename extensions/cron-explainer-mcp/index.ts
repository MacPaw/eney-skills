import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ExplainCron from "./components/explain-cron.js";

const server = new McpServer(
{ name: "cron-explainer-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ExplainCron);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Cron Explainer MCP Server running on stdio");
}

main().catch(console.error);
