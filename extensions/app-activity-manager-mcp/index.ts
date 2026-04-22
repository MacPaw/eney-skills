import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ActivityMonitor from "./components/activity-monitor.js";

const server = new McpServer(
{ name: "app-activity-manager-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ActivityMonitor);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("App Manager MCP Server running on stdio");
}

main().catch(console.error);
