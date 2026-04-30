import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import OnThisDayWidget from "./components/on_this_day.js";

const server = new McpServer(
  { name: "wikipedia-on-this-day-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(OnThisDayWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("On This Day MCP Server running on stdio");
}

main().catch(console.error);
