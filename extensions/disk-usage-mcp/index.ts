import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ShowDiskUsage from "./components/show-disk-usage.js";

const server = new McpServer(
{ name: "disk-usage-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ShowDiskUsage);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Disk Usage MCP Server running on stdio");
}

main().catch(console.error);
